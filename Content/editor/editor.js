/* ---------- Imports ---------- */
import {
	Editor,
	Extension
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
	TextStyle
} from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Image from "@tiptap/extension-image";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.es.js";

/* ---------- Global Variables ---------- */
// Global variables to track view states (loaded from localStorage)
let isCompactView = false;
let showChecklistCount = false;
let showOverdueOnly = false;
let showHasDueDateOnly = false;
let showHasColorOnly = false;
let showHasReminderOnly = false;
let showHasParentNoteOnly = false;
let showHasCommentsOnly = false;
let showHasFolderInfoOnly = false;

/* ---------- Custom Right Blockquote Extension ---------- */
const RightBlockquote = Extension.create({
	name: 'rightBlockquote',
	addGlobalAttributes() {
		return [{
			types: ['blockquote'],
			attributes: {
				'data-type': {
					default: 'left',
					renderHTML: attributes => {
						if (attributes['data-type']) {
							return {
								'data-type': attributes['data-type']
							};
						}
						return {};
					},
					parseHTML: element => element.getAttribute('data-type') || 'left',
				},
			},
		}, ];
	},
	addCommands() {
		return {
			setRightBlockquote: () => ({
				commands
			}) => {
				return commands.wrapIn('blockquote', {
					'data-type': 'right'
				});
			},
			toggleRightBlockquote: () => ({
				commands
			}) => {
				return commands.toggleWrap('blockquote', {
					'data-type': 'right'
				});
			},
			setLeftBlockquote: () => ({
				commands
			}) => {
				return commands.wrapIn('blockquote', {
					'data-type': 'left'
				});
			},
			toggleLeftBlockquote: () => ({
				commands
			}) => {
				return commands.toggleWrap('blockquote', {
					'data-type': 'left'
				});
			},
		};
	},
});

/* ---------- Custom Indent Extension ---------- */
const Indent = Extension.create({
	name: "indent",
	addOptions() {
		return {
			types: ["listItem", "paragraph", "heading"],
			minLevel: 0,
			maxLevel: 10
		};
	},
	addGlobalAttributes() {
		return [{
			types: this.options.types,
			attributes: {
				indent: {
					renderHTML: attributes => {
						return attributes.indent > this.options.minLevel ? {
							"data-indent": attributes.indent
						} : null;
					},
					parseHTML: element => {
						const indentLevel = Number(element.getAttribute("data-indent"));
						return indentLevel && indentLevel > this.options.minLevel ? indentLevel : null;
					}
				}
			}
		}];
	},
	addCommands() {
		const setNodeIndentMarkup = (tr, pos, delta) => {
			const node = tr?.doc?.nodeAt(pos);
			if (node) {
				const nextLevel = (node.attrs.indent || 0) + delta;
				const {
					minLevel,
					maxLevel
				} = this.options;
				const indent = nextLevel < minLevel ? minLevel : nextLevel > maxLevel ? maxLevel : nextLevel;
				if (indent !== node.attrs.indent) {
					const {
						indent: oldIndent,
						...currentAttrs
					} = node.attrs;
					const nodeAttrs = indent > minLevel ? {
						...currentAttrs,
						indent
					} : currentAttrs;
					return tr.setNodeMarkup(pos, node.type, nodeAttrs, node.marks);
				}
			}
			return tr;
		};
		const updateIndentLevel = (tr, delta) => {
			const {
				doc,
				selection
			} = tr;
			if (doc && selection) {
				const {
					from,
					to
				} = selection;
				doc.nodesBetween(from, to, (node, pos) => {
					if (this.options.types.includes(node.type.name)) {
						tr = setNodeIndentMarkup(tr, pos, delta);
						return false;
					}
					return true;
				});
			}
			return tr;
		};
		const applyIndent = direction => () => ({
			tr,
			state,
			dispatch
		}) => {
			const {
				selection
			} = state;
			tr = tr.setSelection(selection);
			tr = updateIndentLevel(tr, direction);
			if (tr.docChanged) {
				dispatch?.(tr);
				return true;
			}
			return false;
		};
		return {
			indent: applyIndent(1),
			outdent: applyIndent(-1)
		};
	},
	addKeyboardShortcuts() {
		return {
			Tab: () => {
				return this.editor.commands.indent();
			},
			"Shift-Tab": () => {
				return this.editor.commands.outdent();
			}
		};
	}
});

/* ---------- TextStyle'a global font attrs ekle ---------- */
const FontAttrs = Extension.create({
	name: 'fontAttrs',
	addGlobalAttributes() {
		return [{
			types: ['textStyle'],
			attributes: {
				fontSize: {
					default: null,
					renderHTML: attrs => attrs.fontSize ? {
						style: `font-size: ${attrs.fontSize}`
					} : {},
					parseHTML: element => element.style.fontSize || null,
				},
				fontFamily: {
					default: null,
					renderHTML: attrs => attrs.fontFamily ? {
						style: `font-family: ${attrs.fontFamily}`
					} : {},
					parseHTML: element => element.style.fontFamily || null,
				},
			},
		}, ];
	},
});

/* ---------- Init Editor ---------- */
let currentSize = 14;
const noteListPreviewLength = 150;
let currentFamily = 'sans-serif';

// Paste event handler for images
function handlePaste(event) {
	const items = (event.clipboardData || event.originalEvent.clipboardData).items;

	for (let item of items) {
		if (item.type.indexOf('image') !== -1) {
			const file = item.getAsFile();
			const reader = new FileReader();

			reader.onload = (e) => {
				const imageUrl = e.target.result;
				editor.chain().focus().setImage({
					src: imageUrl,
					alt: "Pasted image"
				}).run();
			};

			reader.readAsDataURL(file);
			event.preventDefault();
			break;
		}
	}
}

window.editor = new Editor({
	element: document.querySelector('#editor'),
	extensions: [
		StarterKit,
		TaskList,
		TaskItem.configure({
			nested: true
		}),
		TextStyle,
		Color, // uses TextStyle
		Highlight.configure({
			multicolor: true
		}), // bg color
		FontAttrs, // fontSize & fontFamily on textStyle
		Subscript,
		Superscript,
		Placeholder.configure({
			placeholder: 'Start writing your note... Press "/" for action menu.',
		}),
		TextAlign.configure({
			types: ['heading', 'paragraph'],
		}),
		Underline, // underline extension
		Link.configure({
			openOnClick: true,
			HTMLAttributes: {
				class: 'editor-link',
			},
		}),
		Youtube.configure({
			controls: false,
			nocookie: true,
			width: 400,
			height: 225,
		}),
		Image.configure({
			allowBase64: true, // Base64 resimleri destekle
			HTMLAttributes: {
				class: 'editor-image',
			},
		}),
		Indent, // custom indent extension
		RightBlockquote, // custom right blockquote
	],
	content: '',
	editorProps: {
		attributes: {
			'data-placeholder': 'Start writing your note... Press "/" for action menu.',
		},
		handlePaste(view, event) {
			const html = event.clipboardData?.getData('text/html');
			const text = event.clipboardData?.getData('text/plain');
			if (!html && !text) {
				return false;
			}

			// Sadece paste event'ini yakala
			if (event.type !== 'paste') {
				return false;
			}

			event.preventDefault();

			if (html) {
				// Güvenli temizle, style'ı koru
				const clean = DOMPurify.sanitize(html, {
					ALLOWED_TAGS: ['p', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'br', 'div'],
					ALLOWED_ATTR: ['style'],
					KEEP_CONTENT: true,
				});

				// Basit normalize
				let normalized = clean
					.replace(/<b>/g, '<strong>').replace(/<\/b>/g, '</strong>')
					.replace(/<i>/g, '<em>').replace(/<\/i>/g, '</em>')
					.replace(/<u>/g, '<span style="text-decoration:underline">')
					.replace(/<\/u>/g, '</span>')
					.replace(/<s>/g, '<span style="text-decoration:line-through">')
					.replace(/<\/s>/g, '</span>');

				// divleri p'ye çevir (daha stabil parse)
				normalized = normalized.replace(/<div(\s|>)/gi, '<p$1').replace(/<\/div>/gi, '</p>');

				editor.commands.insertContent(normalized, {
					parseOptions: {
						preserveWhitespace: true
					}
				});
				return true;
			}

			if (text) {
				editor.commands.insertContent(text);
				return true;
			}

			return false;
		},
	},
});

// Editor instance'ını local değişken olarak da tanımla
const editor = window.editor;

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const headingBtn = $('heading-btn');
const listBtn = $('list-btn');
const alignBtn = $('align-btn');
const paletteBtn = $('palette-btn');
const actionsBtn = $('actions-btn');
const imageBtn = $('image-btn');
const videoBtn = $('video-btn');
const urlBtn = $('url-btn');

let headingPopup = $('heading-popup');
let listPopup = $('list-popup');
let alignPopup = $('align-popup');
let palettePopup = $('palette-popup');
let actionsPopup = $('actions-popup');

let urlPopup = $('url-popup');
let videoPopup = $('video-popup');
let imagePopup = $('image-popup');

let textPopup = $('text-popup');
let bgPopup = $('bg-popup');
let noteBgPopup = $('note-bg-popup');

let commandPopup = $('command-popup');
let commandFilter = $('command-filter');

let listOptionsBtn = $('list-options-btn');
let listOptionsPopup = $('list-options-popup');

let sortBtn = $('sort-btn');
let sortOptionsPopup = $('sort-options-popup');

const parentNoteBtn = $('parent-note-btn');
const folderPopupBtn = $('folderPopupBtn');

function openPopup(p) {
	p.classList.remove('d-none');
	p.classList.add('d-flex');
}

function closePopup(p) {
	p.classList.add('d-none');
	p.classList.remove('d-flex');
}

function positionPopupAt(popup, rect, bottomLeft = null) {
	let margin = 5;
	let top = (bottomLeft == true) ? (rect.top + window.scrollY - margin) : (rect.bottom + window.scrollY + margin);
	let left = rect.left + window.scrollX;
	popup.style.top = top + 'px';
	popup.style.left = left + 'px';
}

function closeAllPopups() {
	[headingPopup, listPopup, alignPopup, palettePopup, actionsPopup, urlPopup, videoPopup, imagePopup, textPopup, bgPopup, noteBgPopup, commandPopup, listOptionsPopup, sortOptionsPopup].forEach(closePopup);
}

function closeAllPopupsAndModals(excludeId) {
	// Close all popups except the excluded one
	const allPopups = [headingPopup, listPopup, alignPopup, palettePopup, actionsPopup, urlPopup, videoPopup, imagePopup, textPopup, bgPopup, noteBgPopup, commandPopup, listOptionsPopup, sortOptionsPopup];

	allPopups.forEach(popup => {
		if (popup && popup.id !== excludeId) {
			closePopup(popup);
		}
	});

	// Close modals except the excluded one
	const parentNoteModal = document.getElementById('parent-note-modal');
	const commentsModal = document.getElementById('comments-modal');

	if (parentNoteModal && parentNoteModal.id !== excludeId) {
		closeParentNoteModal();
	}

	if (commentsModal && commentsModal.id !== excludeId) {
		closeCommentsModalFunc();
	}
}

/* ---------- Toolbar actions ---------- */
$('bold-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().toggleBold().run();
};
$('italic-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().toggleItalic().run();
};
$('underline-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().toggleUnderline().run();
};
$('strike-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().toggleStrike().run();
};

/* ---------- Actions popup ---------- */
$('actions-btn').onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('actions-popup');
	const isOpen = !actionsPopup.classList.contains('d-none');
	if (isOpen) {
		closePopup(actionsPopup);
	} else {
		positionPopupAt(actionsPopup, actionsBtn.getBoundingClientRect());
		openPopup(actionsPopup);
	}
};

$('clear-format-btn').onclick = () => {
	editor.chain().focus()
		// Text formatting
		.unsetBold()
		.unsetItalic()
		.unsetUnderline()
		.unsetStrike()
		.unsetSubscript()
		.unsetSuperscript()
		.unsetColor()
		.unsetHighlight()
		.unsetMark('textStyle')
		//.setParagraph()
		.run();
};

/* ---------- Undo/Redo buttons ---------- */
$('undo-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().undo().run();
};
$('redo-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().redo().run();
};

/* ---------- Actions popup buttons ---------- */
$('subscript-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().toggleSubscript().run();
};
$('superscript-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().toggleSuperscript().run();
};
$('indent-decrease-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().indent().run();
};

$('indent-increase-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().outdent().run();
};
$('blockquote-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().toggleLeftBlockquote().run();
};
$('codeblock-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().toggleCodeBlock().run();
};
$('hr-btn').onclick = () => {
	closeAllPopups();
	editor.chain().focus().setHorizontalRule().run();
};

/* ---------- URL popup ---------- */
$('url-btn').onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('url-popup');
	const isOpen = !urlPopup.classList.contains('d-none');
	if (isOpen) {
		closePopup(urlPopup);
	} else {
		// Seçili metni link text olarak doldur
		const {
			from,
			to
		} = editor.state.selection;
		const selectedText = editor.state.doc.textBetween(from, to);
		if (selectedText) {
			$('link-text').value = selectedText;
		}
		$('link-url').value = '';
		$('link-url').focus();
		positionPopupAt(urlPopup, urlBtn.getBoundingClientRect());
		openPopup(urlPopup);
	}
};

// URL popup butonları
$('url-cancel').onclick = () => closePopup(urlPopup);

$('url-insert').onclick = () => {
	const linkText = $('link-text').value.trim();
	const linkUrl = $('link-url').value.trim();

	if (!linkUrl) {
		$('link-url').focus();
		return;
	}

	// URL formatını kontrol et
	if (!linkUrl.match(/^https?:\/\//)) {
		$('link-url').value = 'https://' + linkUrl;
	}

	if (linkText) {
		// Link text varsa, seçili metni link text ile değiştir
		editor.chain().focus().insertContent(`<a href="${$('link-url').value}">${linkText}</a>`).run();
	} else {
		// Link text yoksa, URL'yi link olarak ekle
		editor.chain().focus().insertContent(`<a href="${$('link-url').value}">${$('link-url').value}</a>`).run();
	}

	closePopup(urlPopup);
};

// Enter tuşu ile URL ekleme
$('link-url').addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		e.preventDefault();
		$('url-insert').click();
	}
});

// URL input validasyonu
$('link-url').addEventListener('input', (e) => {
	const url = e.target.value.trim();
	const insertBtn = $('url-insert');
	insertBtn.disabled = !url;
});

/* ---------- Video popup ---------- */
$('video-btn').onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('video-popup');
	const isOpen = !videoPopup.classList.contains('d-none');
	if (isOpen) {
		closePopup(videoPopup);
	} else {
		$('video-url').value = '';
		$('video-url').focus();
		positionPopupAt(videoPopup, videoBtn.getBoundingClientRect());
		openPopup(videoPopup);
	};
};

// Video popup butonları
$('video-cancel').onclick = () => closePopup(videoPopup);

$('video-insert').onclick = () => {
	const videoUrl = $('video-url').value.trim();

	if (!videoUrl) {
		$('video-url').focus();
		return;
	}

	// YouTube URL'lerini embed formatına çevir
	let embedUrl = videoUrl;

	// YouTube watch URL'lerini embed formatına çevir
	if (videoUrl.includes('youtube.com/watch?v=')) {
		const videoId = videoUrl.split('v=')[1]?.split('&')[0];
		if (videoId) {
			embedUrl = `https://www.youtube.com/embed/${videoId}`;
		}
	}
	// YouTube youtu.be URL'lerini embed formatına çevir
	else if (videoUrl.includes('youtu.be/')) {
		const videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
		if (videoId) {
			embedUrl = `https://www.youtube.com/embed/${videoId}`;
		}
	}
	// Zaten embed formatındaysa olduğu gibi kullan
	else if (videoUrl.includes('youtube.com/embed/')) {
		embedUrl = videoUrl;
	}

	// Video ekle
	editor.chain().focus().setYoutubeVideo({
		src: embedUrl
	}).run();

	closePopup(videoPopup);
};

// Enter tuşu ile video ekleme
$('video-url').addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		e.preventDefault();
		$('video-insert').click();
	}
});

// Video input validasyonu
$('video-url').addEventListener('input', (e) => {
	const url = e.target.value.trim();
	const insertBtn = $('video-insert');
	insertBtn.disabled = !url;
});

/* ---------- Image popup ---------- */
$('image-btn').onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('image-popup');
	const isOpen = !imagePopup.classList.contains('d-none');
	if (isOpen) {
		closePopup(imagePopup);
	} else {
		$('image-file').value = '';
		positionPopupAt(imagePopup, imageBtn.getBoundingClientRect());
		openPopup(imagePopup);
	}
};

// Image popup butonları
$('image-cancel').onclick = () => closePopup(imagePopup);

$('image-insert').onclick = () => {
	const fileInput = $('image-file');
	const file = fileInput.files[0];

	if (!file) {
		fileInput.focus();
		return;
	}

	// Dosya boyutunu kontrol et (5MB limit)
	if (file.size > 5 * 1024 * 1024) {
		alert('Dosya boyutu 5MB\'dan büyük olamaz.');
		return;
	}

	// Dosya tipini kontrol et
	if (!file.type.startsWith('image/')) {
		alert('Lütfen geçerli bir resim dosyası seçin.');
		return;
	}

	// FileReader ile resmi oku
	const reader = new FileReader();
	reader.onload = (e) => {
		const imageUrl = e.target.result;

		// Resmi editor'a ekle
		const result = editor.chain().focus().setImage({
			src: imageUrl,
			alt: "Uploaded image"
		}).run();

		closePopup(imagePopup);
	};
	reader.readAsDataURL(file);
};

// Image file input değişikliği
$('image-file').addEventListener('change', (e) => {
	const file = e.target.files[0];
	const insertBtn = $('image-insert');
	insertBtn.disabled = !file;
});

/* ---------- Font size ---------- */
function applyFontSize(px) {
	editor.chain().focus().setMark('textStyle', {
		fontSize: `${px}px`
	}).run();
	$('font-size-label').textContent = `${px}px`;
	currentSize = px;
}
$('font-inc').onclick = () => {
	currentSize += 1;
	applyFontSize(currentSize);
};
$('font-dec').onclick = () => {
	if (currentSize > 8) {
		currentSize -= 1;
		applyFontSize(currentSize);
	}
};

// Font size label'a tıklandığında 14px'e döndür
$('font-size-label').onclick = () => {
	const defaultSize = 14; // Varsayılan font boyutu
	currentSize = defaultSize;
	applyFontSize(currentSize);
};

/* ---------- Font family ---------- */
$('font-family-select').onchange = (e) => {
	const family = e.target.value;
	editor.chain().focus().setMark('textStyle', {
		fontFamily: family
	}).run();
	currentFamily = family;
};

/* ---------- Selection sync (font size & family) ---------- */
editor.on('selectionUpdate', () => {
	const {
		from,
		to
	} = editor.state.selection;
	let foundSize = null;
	let foundFamily = null;

	editor.state.doc.nodesBetween(from, to, node => {
		if (node.type && node.type.name === 'text' && node.marks) {
			const ts = node.marks.find(m => m.type.name === 'textStyle');
			if (ts) {
				if (ts.attrs.fontSize) {
					foundSize = ts.attrs.fontSize;
				}
				if (ts.attrs.fontFamily) {
					foundFamily = ts.attrs.fontFamily;
				}
			}
		}
	});

	if (!foundSize) {
		foundSize = '14px';
	}
	currentSize = parseInt(foundSize, 10);
	$('font-size-label').textContent = foundSize;

	if (!foundFamily) {
		foundFamily = 'sans-serif';
	}
	currentFamily = foundFamily;
	$('font-family-select').value = foundFamily;
});

/* ---------- Heading popup ---------- */
headingBtn.onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('heading-popup');
	const isOpen = !headingPopup.classList.contains('d-none');
	if (isOpen) {
		closePopup(headingPopup);
	} else {
		positionPopupAt(headingPopup, headingBtn.getBoundingClientRect());
		openPopup(headingPopup);
	}
};

headingPopup.querySelectorAll('button').forEach(btn => {
	btn.onclick = () => {
		const level = parseInt(btn.dataset.level);
		editor.chain().focus().toggleHeading({
			level
		}).run();
		closePopup(headingPopup);
	};
});

/* ---------- List popup ---------- */
listBtn.onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('list-popup');
	const isOpen = !listPopup.classList.contains('d-none');
	if (isOpen) {
		closePopup(listPopup);
	} else {
		positionPopupAt(listPopup, listBtn.getBoundingClientRect());
		openPopup(listPopup);
	}
};

listPopup.querySelectorAll('button').forEach(btn => {
	btn.onclick = () => {
		const a = btn.dataset.action;
		if (a === 'bullet') {
			editor.chain().focus().toggleBulletList().run();
			closePopup(listPopup);
		}
		if (a === 'ordered') {
			editor.chain().focus().toggleOrderedList().run();
			closePopup(listPopup);
		}
		if (a === 'task') {
			editor.chain().focus().toggleTaskList().run();
			closePopup(listPopup);
		}
	};
});

/* ---------- Alignment popup ---------- */
alignBtn.onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('align-popup');
	const isOpen = !alignPopup.classList.contains('d-none');
	if (isOpen) {
		closePopup(alignPopup);
	} else {
		positionPopupAt(alignPopup, alignBtn.getBoundingClientRect());
		openPopup(alignPopup);
	}
};

alignPopup.querySelectorAll('button').forEach(btn => {
	btn.onclick = () => {
		const align = btn.dataset.align;
		if (align === 'left') {
			editor.chain().focus().setTextAlign('left').run();
			closePopup(alignPopup);
		}
		if (align === 'center') {
			editor.chain().focus().setTextAlign('center').run();
			closePopup(alignPopup);
		}
		if (align === 'right') {
			editor.chain().focus().setTextAlign('right').run();
			closePopup(alignPopup);
		}
		if (align === 'justify') {
			editor.chain().focus().setTextAlign('justify').run();
			closePopup(alignPopup);
		}
	};
});

/* ---------- Palette selector ---------- */
paletteBtn.onclick = (e) => {
	closeAllPopupsAndModals('palette-popup');
	const isOpen = !palettePopup.classList.contains('d-none');
	if (isOpen) {
		closePopup(palettePopup);
	} else {
		positionPopupAt(palettePopup, paletteBtn.getBoundingClientRect());
		openPopup(palettePopup);
	}
};

const textBtn = $('textcolor-btn');
const bgBtn = $('bgcolor-btn');

textBtn.onclick = (e) => {
	e.stopPropagation();
	closePopup(palettePopup);
	positionPopupAt(textPopup, paletteBtn.getBoundingClientRect());
	openPopup(textPopup);
};
bgBtn.onclick = (e) => {
	e.stopPropagation();
	closePopup(palettePopup);
	positionPopupAt(bgPopup, paletteBtn.getBoundingClientRect());
	openPopup(bgPopup);
};

// text colors
textPopup.querySelectorAll('.swatch[data-color]').forEach(s => {
	s.onclick = () => {
		editor.chain().focus().setColor(s.dataset.color).run();
		closePopup(textPopup);
	};
});
$('text-clear').onclick = () => {
	editor.chain().focus().unsetColor().run();
	closePopup(textPopup);
};

// bg colors
bgPopup.querySelectorAll('.swatch[data-color]').forEach(s => {
	s.onclick = () => {
		editor.chain().focus().setHighlight({
			color: s.dataset.color
		}).run();
		closePopup(bgPopup);
	};
});
$('bg-clear').onclick = () => {
	editor.chain().focus().unsetHighlight().run();
	closePopup(bgPopup);
};

/* ---------- List options popup ---------- */
listOptionsBtn.onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('list-options-popup');
	const isOpen = !listOptionsPopup.classList.contains('d-none');

	if (isOpen) {
		closePopup(listOptionsPopup);
	} else {
		positionPopupAt(listOptionsPopup, listOptionsBtn.getBoundingClientRect());
		openPopup(listOptionsPopup);
		updateListOptionsUI(); // Update selected items

		// Add click event listeners when popup opens
		document.querySelectorAll('#list-options-popup .popup-form-item').forEach(item => {
			// Remove existing listeners to avoid duplicates
			item.removeEventListener('click', item._listOptionClickHandler);

			// Create new handler
			item._listOptionClickHandler = function() {
				const action = this.dataset.action;

				switch (action) {
					case 'toggle-compact':
						toggleCompactView();
						break;
					case 'toggle-checklist-count':
						toggleChecklistCount();
						break;
					case 'toggle-has-color':
						toggleHasColor();
						break;
					case 'toggle-has-due-date':
						toggleHasDueDate();
						break;
					case 'toggle-overdue':
						toggleOverdue();
						break;
					case 'toggle-has-reminder':
						toggleHasReminder();
						break;
					case 'toggle-has-parent-note':
						toggleHasParentNote();
						break;
					case 'toggle-has-comments':
						toggleHasComments();
						break;
					case 'toggle-has-folder-info':
						toggleHasFolderInfo();
						break;
				}

				// Close popup after action
				closePopup(listOptionsPopup);
			};

			// Add the listener
			item.addEventListener('click', item._listOptionClickHandler);
		});
	}
};

// Sort button click handler
sortBtn.onclick = (e) => {
	e.stopPropagation();
	closeAllPopupsAndModals('sort-options-popup');
	const isOpen = !sortOptionsPopup.classList.contains('d-none');

	if (isOpen) {
		closePopup(sortOptionsPopup);
	} else {
		positionPopupAt(sortOptionsPopup, sortBtn.getBoundingClientRect());
		openPopup(sortOptionsPopup);
		updateSortPopupItems();

		// Add click event listeners when popup opens
		document.querySelectorAll('#sort-options-popup .popup-form-item').forEach(item => {
			// Remove existing listeners to avoid duplicates
			item.removeEventListener('click', item._sortOptionClickHandler);

			// Create new handler
			item._sortOptionClickHandler = function() {
				const action = this.dataset.action;

				switch (action) {
					case 'sort-title':
						sortNotes('title');
						break;
					case 'sort-created':
						sortNotes('created');
						break;
					case 'sort-updated':
						sortNotes('updated');
						break;
				}

				// Update sort popup UI to show current selection
				updateSortPopupItems();
			};

			// Add the listener
			item.addEventListener('click', item._sortOptionClickHandler);
		});
	}
};

/* ---------- Command Menu Popup ---------- */
let commandMenuActive = false;
let commandMenuStart = null;
let selectedCommandItem = 0;
let commandItems = [];

function openCommandPopup() {
	commandMenuActive = true;
	selectedCommandItem = 0;
	commandItems = Array.from(commandPopup.querySelectorAll('.command-item'));
	updateCommandSelection();

	// Editördeki cursor pozisyonunu al
	const {
		from
	} = editor.state.selection;
	const coords = editor.view.coordsAtPos(from);

	// Popup'ı cursor pozisyonunda aç
	positionPopupAt(commandPopup, {
		top: coords.top,
		left: coords.left,
		bottom: coords.bottom,
		right: coords.right
	});

	openPopup(commandPopup);
	setTimeout(() => commandFilter.focus(), 50);
}

function closeCommandPopup() {
	commandMenuActive = false;
	commandMenuStart = null;
	closePopup(commandPopup);
	commandFilter.value = '';
}

function updateCommandSelection() {
	commandItems.forEach((item, index) => {
		item.classList.toggle('selected', index === selectedCommandItem);
	});
}

function executeCommand(command) {
	if (commandMenuStart !== null) {
		editor.chain().focus().deleteRange({
			from: commandMenuStart,
			to: editor.state.selection.from
		}).run();
	}

	switch (command) {
		case 'text':
			editor.chain().focus().setParagraph().run();
			break;
		case 'h1':
			editor.chain().focus().setHeading({
				level: 1
			}).run();
			break;
		case 'h2':
			editor.chain().focus().setHeading({
				level: 2
			}).run();
			break;
		case 'h3':
			editor.chain().focus().setHeading({
				level: 3
			}).run();
			break;
		case 'bullet':
			editor.chain().focus().toggleBulletList().run();
			break;
		case 'ordered':
			editor.chain().focus().toggleOrderedList().run();
			break;
		case 'task':
			editor.chain().focus().toggleTaskList().run();
			break;
		case 'quote':
			editor.chain().focus().toggleBlockquote().run();
			break;
		case 'code':
			editor.chain().focus().toggleCodeBlock().run();
			break;
		case 'divider':
			editor.chain().focus().setHorizontalRule().run();
			break;
		case 'link':
			closeCommandPopup();
			setTimeout(() => {
				editor.chain().focus().run();
				$('url-btn').click();
			}, 100);
			return;
		case 'video':
			closeCommandPopup();
			setTimeout(() => {
				editor.chain().focus().run();
				$('video-btn').click();
			}, 100);
			return;
		case 'image':
			closeCommandPopup();
			setTimeout(() => {
				editor.chain().focus().run();
				$('image-btn').click();
			}, 100);
			return;
		case 'ai':
			closeCommandPopup();
			setTimeout(() => {
				editor.chain().focus().run();
				// AI functionality placeholder
				alert('AI functionality coming soon!');
			}, 100);
			return;
	}
	closeCommandPopup();
}

/* ---------- Action Buttons ---------- */


function filterCommandItems() {
	const filter = commandFilter.value.toLowerCase();
	commandItems.forEach((item, index) => {
		const text = item.textContent.toLowerCase();
		const visible = text.includes(filter);
		item.style.display = visible ? 'flex' : 'none';
		if (visible && index < selectedCommandItem) {
			selectedCommandItem = index;
		}
	});
	updateCommandSelection();
}

// Command menu event listeners
commandFilter.addEventListener('input', filterCommandItems);
commandFilter.addEventListener('keydown', (e) => {
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		selectedCommandItem = Math.min(selectedCommandItem + 1, commandItems.length - 1);
		updateCommandSelection();
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		selectedCommandItem = Math.max(selectedCommandItem - 1, 0);
		updateCommandSelection();
	} else if (e.key === 'Enter') {
		e.preventDefault();
		const selectedItem = commandItems[selectedCommandItem];
		if (selectedItem) {
			const command = selectedItem.dataset.command;
			executeCommand(command);
		}
	} else if (e.key === 'Escape') {
		closeCommandPopup();
	}
});

// Command menu items click handlers
commandPopup.querySelectorAll('.command-item').forEach(item => {
	item.addEventListener('click', () => {
		const command = item.dataset.command;
		executeCommand(command);
	});
});

// Close command popup when clicking outside
document.addEventListener('click', (e) => {
	if (commandMenuActive && !commandPopup.contains(e.target)) {
		closeCommandPopup();
	}
});

// Command menu detection
editor.on('update', ({
	editor
}) => {
	const {
		from,
		to
	} = editor.state.selection;
	const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from);

	if (textBefore === '/' && !commandMenuActive) {
		commandMenuStart = from - 1;
		openCommandPopup();
	} else if (commandMenuActive && (from !== to || textBefore !== '/')) {
		closeCommandPopup();
	}

	// Sayaç güncelle
	updateEditorCounter();
});

// Handle escape key
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && commandMenuActive) {
		closeCommandPopup();
	}
});

// Editor sağ tık ile command menu açma
editor.view.dom.addEventListener('contextmenu', (e) => {
	e.preventDefault();

	// Command popup'ı aç
	openCommandPopup();

	// Popup'ı tıklanan pozisyonda konumlandır
	positionPopupAt(commandPopup, {
		top: e.clientY,
		left: e.clientX,
		bottom: e.clientY + 20,
		right: e.clientX + 20
	});
});

/* ---------- Database system moved to db.js ---------- */


async function saveNote() {
	// Çöp kutusu görünümündeyse kaydetmeyi engelle
	if (currentView === 'trash') {
		showNotification('Çöp kutusundaki notlar güncellenemez!', 'info');
		return;
	}

	const title = $('note-title').value.trim();
	const content = editor.getHTML();
	const now = new Date().toISOString();

	// Checklist verilerini al
	const checklistData = JSON.stringify(checklistItems);

	// Editor background color'ını al
	const bgColor = document.getElementById('editor-control').style.backgroundColor || '';

	// Başlık zorunlu kontrolü
	if (!title) {
		showNotification('Lütfen not başlığı giriniz!', 'info');
		$('note-title').focus();
		return;
	}


	// Eğer mevcut bir not seçiliyse güncelle, değilse yeni oluştur
	if (currentNoteId) {
		// Mevcut notun favori durumunu koru
		const existingNote = await window.getNoteById(currentNoteId);
		const note = {
			id: currentNoteId,
			title,
			content,
			checklistData,
			bgColor,
			dueDate: currentNoteDueDate,
			reminderDateTime: currentNoteReminderDateTime,
			parentNoteId: currentParentNoteId,
			folderId: currentFolderId,
			tags: currentTagIds.join(','),
			updatedAt: now,
			isFavorite: existingNote ? existingNote.isFavorite : false,
			isArchived: existingNote ? existingNote.isArchived : false,
			isDeleted: existingNote ? existingNote.isDeleted : false
		};

		try {
			await window.updateNoteById(currentNoteId, note);
			await reloadCurrentView();
			await updateSidebarCounts();
				showNotification('Not başarıyla güncellendi!', 'success');
			return currentNoteId;
		} catch (error) {
			console.error('Error updating note:', error);
			throw error;
		}
	} else {
		// Yeni not oluştur
		const note = {
			title,
			content,
			checklistData,
			bgColor,
			dueDate: currentNoteDueDate,
			reminderDateTime: currentNoteReminderDateTime,
			parentNoteId: currentParentNoteId,
			folderId: currentFolderId,
			tags: currentTagIds.join(','),
			createdAt: now,
			updatedAt: now,
			isArchived: false,
			isDeleted: false
		};

		try {
			const newNoteId = await window.createNote(note);
			await reloadCurrentView();
			await updateSidebarCounts();
				showNotification('Yeni not başarıyla oluşturuldu!', 'success');
				clearEditor();
			return newNoteId;
					} catch (error) {
			console.error('Error saving note:', error);
			throw error;
		}
	}
}

async function loadNotes() {
	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			hasOverdue: showOverdueOnly,
			hasDueDate: showHasDueDateOnly,
			hasColor: showHasColorOnly,
			hasReminder: showHasReminderOnly,
			hasParentNote: showHasParentNoteOnly,
			hasComments: showHasCommentsOnly,
			hasFolder: showHasFolderInfoOnly,
			sortBy: currentSortOption,
			sortDirection: currentSortDirection,
			getCommentsByNoteIdFunc: getCommentsByNoteId
		});

			await displayNotes(notes);

			// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in loadNotes:', error);
		throw error;
	}
}

// Show all notes (default view)
async function showAllNotes() {
	currentView = 'notes';
	updateNotesHeaderTitle('Notlar');
	clearEditor();

	// Editor panelini aktif et
	const editorPanel = document.querySelector('.editor-panel');
	if (editorPanel) {
		editorPanel.classList.remove('disabled');
	}

	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			sortBy: currentSortOption,
			sortDirection: currentSortDirection
		});

			await displayNotes(notes);

			// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in showAllNotes:', error);
		throw error;
	}
}

// Show favorite notes
async function showFavorites() {
	currentView = 'favorites';
	updateNotesHeaderTitle('Notlar');
	clearEditor();

	// Editor panelini aktif et
	const editorPanel = document.querySelector('.editor-panel');
	if (editorPanel) {
		editorPanel.classList.remove('disabled');
	}

	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			onlyFavorites: true,
			sortBy: currentSortOption,
			sortDirection: currentSortDirection
		});

			await displayNotes(notes);

			// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in showFavorites:', error);
		throw error;
	}
}

// Show archived notes
async function showArchived() {
	currentView = 'archive';
	updateNotesHeaderTitle('Notlar');
	clearEditor();

	// Editor panelini aktif et
	const editorPanel = document.querySelector('.editor-panel');
	if (editorPanel) {
		editorPanel.classList.remove('disabled');
	}

	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			onlyArchived: true,
			sortBy: currentSortOption,
			sortDirection: currentSortDirection
		});

			await displayNotes(notes);

			// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in showArchived:', error);
		throw error;
	}
}

// Show reminder notes
async function showReminders() {
	currentView = 'reminders';
	updateNotesHeaderTitle('Notlar');
	clearEditor();

	// Editor panelini aktif et
	const editorPanel = document.querySelector('.editor-panel');
	if (editorPanel) {
		editorPanel.classList.remove('disabled');
	}

	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			hasReminder: true,
			sortBy: currentSortOption,
			sortDirection: currentSortDirection
		});

			await displayNotes(notes);

			// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in showReminders:', error);
		throw error;
	}
}

// Update notes header title
function updateNotesHeaderTitle(title) {
	const headerTitle = document.querySelector('.notes-header-section h3');
	if (headerTitle) {
		headerTitle.textContent = title;
	}
}

// Show tags list
async function showTags() {
	currentView = 'tags';
	updateNotesHeaderTitle('Etiketler');
	clearEditor();

	// Editor panelini devre dışı bırak
	const editorPanel = document.querySelector('.editor-panel');
	if (editorPanel) {
		editorPanel.classList.add('disabled');
	}

	try {
		// Call db.js to get all tags
		const tags = await window.getAllTags();

			// Sort tags by name
			tags.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

			await displayTags(tags);
		return tags;
	} catch (error) {
		console.error('Error in showTags:', error);
		throw error;
	}
}

// Show folders list
async function showFolders() {
	currentView = 'folders';
	updateNotesHeaderTitle('Klasörler');
	clearEditor();

	// Editor panelini devre dışı bırak
	const editorPanel = document.querySelector('.editor-panel');
	if (editorPanel) {
		editorPanel.classList.add('disabled');
	}

	try {
		// Call db.js to get all folders
		const folders = await window.getAllFolders();

			// Sort folders by name
			folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

			await displayFolders(folders);
		return folders;
	} catch (error) {
		console.error('Error in showFolders:', error);
		throw error;
	}
}

// Display tags in the notes panel
async function displayTags(tags) {
	const notesList = document.querySelector('.notes-list');
	if (!notesList) return;

	// Clear existing content
	notesList.innerHTML = '';

	if (tags.length === 0) {
		notesList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Listede etiket yer almıyor.</p>';
		return;
	}

	// Create tag items with usage counts
	for (const tag of tags) {
		// Get usage count for this tag
		const usageCount = await getTagUsageCount(tag.id);

		const tagItem = document.createElement('div');
		tagItem.className = 'note-item tag-item';
		tagItem.dataset.tagId = tag.id;

		// Set tag colors if available
		const tagStyle = [];

		if (tag.fontColor) {
			tagStyle.push(`color: ${tag.fontColor} !important`);
		}
		if (tag.bgColor) {
			tagStyle.push(`background-color: ${tag.bgColor}`);
		}

		tagItem.style.cssText = tagStyle.join('; ');

		tagItem.innerHTML = `
      <div class="note-content">
        <div class="note-title">
          <i class="bi bi-tag"></i>
          <span style="${tag.fontColor ? `color: ${tag.fontColor} !important;` : ''}">${tag.name || 'İsimsiz Etiket'}</span>
        </div>
        <div class="note-meta">
          <span class="note-date">${new Date(tag.createdAt).toLocaleDateString('tr-TR')}</span>
          ${usageCount > 0 ? `<span class="tag-usage-count">${usageCount} Not</span>` : ''}
        </div>
      </div>
    `;

		// Add click event to edit tag
		tagItem.addEventListener('click', () => {
			openTagModalForEdit(tag);
		});

		// Add context menu event for tag deletion
		tagItem.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			showTagContextMenu(e, tag);
		});

		notesList.appendChild(tagItem);
	}
}

// Display folders in the notes panel
async function displayFolders(folders) {
	const notesList = document.querySelector('.notes-list');
	if (!notesList) return;

	// Clear existing content
	notesList.innerHTML = '';

	if (folders.length === 0) {
		notesList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Listede klasör yer almıyor.</p>';
		return;
	}

	// Get all notes to calculate usage count
	const notes = await getAllNotes();

	// Create folder items
	folders.forEach(folder => {
		const folderItem = document.createElement('div');
		folderItem.className = 'note-item folder-item';
		folderItem.dataset.folderId = folder.id;

		// Set folder colors if available
		const folderStyle = [];

		if (folder.fontColor) {
			folderStyle.push(`color: ${folder.fontColor} !important`);
		}
		if (folder.bgColor) {
			folderStyle.push(`background-color: ${folder.bgColor}`);
		}

		folderItem.style.cssText = folderStyle.join('; ');

		// Count notes using this folder
		const usageCount = notes.filter(note => note.folderId === folder.id).length;

		folderItem.innerHTML = `
      <div class="note-content">
        <div class="note-title">
          <i class="bi bi-folder2"></i>
          <span style="${folder.fontColor ? `color: ${folder.fontColor} !important;` : ''}">${folder.name || 'İsimsiz Klasör'}</span>
        </div>
        <div class="note-meta">
          <span class="note-date">${new Date(folder.createdAt).toLocaleDateString('tr-TR')}</span>
          ${usageCount > 0 ? `<span class="tag-usage-count">${usageCount} Not</span>` : ''}
        </div>
      </div>
    `;

		// Add click event to edit folder
		folderItem.addEventListener('click', () => {
			openFolderModalForEdit(folder);
		});

		// Add context menu event for folder deletion
		folderItem.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			showFolderContextMenu(e, folder);
		});

		notesList.appendChild(folderItem);
	});
}

// Open folder modal for editing
function openFolderModalForEdit(folder) {
	const modal = document.getElementById('new-folder-modal');
	const input = document.getElementById('new-folder-name-input');

	// Set input value and colors
	input.value = folder.name || '';
	selectedFolderTextColor = folder.fontColor || null;
	selectedFolderBgColor = folder.bgColor || null;

	// Populate color swatches
	populateFolderColor();

	// Update color selection visual feedback
	updateFolderColorSelection('text');
	updateFolderColorSelection('bg');

	// Store the folder ID for update
	modal.dataset.editingFolderId = folder.id;

	// Show modal
	modal.classList.remove('d-none');
	modal.classList.add('d-flex');

	// Focus input
	setTimeout(() => input.focus(), 100);

	// Add Enter key listener
	input.onkeydown = (e) => {
		if (e.key === 'Enter') {
			// Validate before saving
			const folderName = input.value.trim();
			if (!folderName || folderName.length === 0) {
				showNotification('Klasör adı boş olamaz!', 'error');
				input.focus();
				return;
			}
			if (folderName.length < 2) {
				showNotification('Klasör adı en az 2 karakter olmalıdır!', 'error');
				input.focus();
				return;
			}
			updateFolder(folder.id);
		}
	};
}

// Update existing folder
async function updateFolder(folderId) {
	const input = document.getElementById('new-folder-name-input');
	const folderName = input.value.trim();

	if (!folderName || folderName.length === 0) {
		showNotification('Klasör adı boş olamaz!', 'error');
		input.focus();
		return;
	}

	if (folderName.length < 2) {
		showNotification('Klasör adı en az 2 karakter olmalıdır!', 'error');
		input.focus();
		return;
	}

	try {
		// Check for duplicate name
		const isDuplicate = await window.checkDuplicateFolder(folderName, folderId);
		if (isDuplicate) {
				showNotification('Bu isimde bir klasör zaten mevcut!', 'error');
				input.focus();
				return;
			}

			// Update folder
		await window.updateFolderById(folderId, {
			name: folderName,
			fontColor: selectedFolderTextColor,
			bgColor: selectedFolderBgColor
		});

						showNotification('Klasör başarıyla güncellendi!', 'success');
						closeNewFolderModal();
						await updateSidebarCounts();

						if (currentView === 'folders') {
							await showFolders();
						}
	} catch (error) {
		console.error('Error in updateFolder:', error);
						showNotification('Klasör güncellenirken hata oluştu!', 'error');
		throw error;
	}
}

// Show folder context menu
function showFolderContextMenu(event, folder) {
	event.preventDefault();

	// Store the context menu folder for use in actions
	window.contextMenuFolder = folder;

	const contextMenu = document.getElementById('context-menu');
	if (!contextMenu) return;

	// Clear existing content
	contextMenu.innerHTML = '';

	// Create delete option
	const deleteItem = document.createElement('div');
	deleteItem.className = 'context-item';
	deleteItem.setAttribute('data-action', 'delete-folder');
	deleteItem.innerHTML = `
    <i class="bi bi-trash"></i>
    <span>Sil</span>
  `;

	// Add click event
	deleteItem.addEventListener('click', () => {
		deleteFolder(folder);
		hideContextMenu();
	});

	contextMenu.appendChild(deleteItem);

	// Position context menu at mouse cursor position
	const mouseX = event.clientX;
	const mouseY = event.clientY;

	contextMenu.style.left = mouseX + 'px';
	contextMenu.style.top = mouseY + 'px';
	contextMenu.classList.remove('d-none');
}

// Get all notes
async function getAllNotes() {
	try {
		// Call db.js function
		return await window.getAllNotes();
	} catch (error) {
		console.error('Error in getAllNotes:', error);
		throw error;
	}
}

// Delete folder function
async function deleteFolder(folder) {
	// Check if folder is used in any notes
	const notes = await getAllNotes();
	const notesUsingFolder = notes.filter(note => note.folderId === folder.id);

	if (notesUsingFolder.length > 0) {
		// Folder is used, show confirmation modal
		showFolderDeleteConfirmationModal(folder, notesUsingFolder.length);
	} else {
		// Folder is not used, delete directly
		await performFolderDeletion(folder.id);
	}
}

// Perform actual folder deletion
async function performFolderDeletion(folderId) {
	try {
		// Remove folder from all notes first
		await window.removeFolderFromAllNotes(folderId);

		// Now delete the folder itself
		await window.deleteFolderById(folderId);

		showNotification('Klasör başarıyla silindi!', 'success');
		await updateSidebarCounts();

		if (currentView === 'folders') {
			await showFolders();
		}
	} catch (error) {
		console.error('Error in performFolderDeletion:', error);
		showNotification('Klasör silinirken hata oluştu!', 'error');
	}
}

// Show folder delete confirmation modal
function showFolderDeleteConfirmationModal(folder, usageCount) {
	// Create modal if it doesn't exist
	let modal = document.getElementById('folder-delete-confirmation-modal');
	if (!modal) {
		modal = document.createElement('div');
		modal.id = 'folder-delete-confirmation-modal';
		modal.className = 'modal-overlay d-none';
		modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Klasör Silme Onayı</h3>
          <button class="modal-close" onclick="closeFolderDeleteConfirmationModal()">
            <i class="bi bi-x"></i>
          </button>
        </div>
        <div class="modal-body">
          <p id="folder-delete-message"></p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary" onclick="closeFolderDeleteConfirmationModal()">
            İptal
          </button>
          <button class="modal-btn modal-btn-danger" onclick="confirmFolderDeletion()">
            Klasörü Sil
          </button>
        </div>
      </div>
    `;
		document.body.appendChild(modal);
	}

	// Update message
	const messageElement = document.getElementById('folder-delete-message');
	if (messageElement) {
		messageElement.innerHTML = `Sildiğiniz klasör "${folder.name}" ${usageCount} adet notta tanımlı.</br>Notlar silinmeyecek, sadece ilgili klasör kaldırılacaktır.</br>Onaylıyor musunuz?`;
	}

	// Store folder for confirmation
	window.folderToDelete = folder;

	// Show modal
	modal.classList.remove('d-none');
	modal.classList.add('d-flex');
}

// Close folder delete confirmation modal
function closeFolderDeleteConfirmationModal() {
	const modal = document.getElementById('folder-delete-confirmation-modal');
	if (modal) {
		modal.classList.add('d-none');
		modal.classList.remove('d-flex');
	}
	window.folderToDelete = null;
}

// Confirm folder deletion
async function confirmFolderDeletion() {
	if (window.folderToDelete) {
		await performFolderDeletion(window.folderToDelete.id);
		closeFolderDeleteConfirmationModal();
	}
}

// Make functions globally available
window.closeFolderDeleteConfirmationModal = closeFolderDeleteConfirmationModal;
window.confirmFolderDeletion = confirmFolderDeletion;

// Show tag context menu
function showTagContextMenu(event, tag) {
	event.preventDefault();

	// Store the context menu tag for use in actions
	window.contextMenuTag = tag;

	const contextMenu = document.getElementById('context-menu');
	if (!contextMenu) return;

	// Clear existing content
	contextMenu.innerHTML = '';

	// Create delete option
	const deleteItem = document.createElement('div');
	deleteItem.className = 'context-item';
	deleteItem.setAttribute('data-action', 'delete-tag');
	deleteItem.innerHTML = `
    <i class="bi bi-trash"></i>
    <span>Sil</span>
  `;

	// Add click event
	deleteItem.addEventListener('click', () => {
		deleteTag(tag);
		hideContextMenu();
	});

	contextMenu.appendChild(deleteItem);

	// Position context menu at mouse cursor position
	const mouseX = event.clientX;
	const mouseY = event.clientY;

	contextMenu.style.left = mouseX + 'px';
	contextMenu.style.top = mouseY + 'px';
	contextMenu.classList.remove('d-none');
}

// Delete tag function
async function deleteTag(tag) {
	// Check if tag is used in any notes
	const usageCount = await getTagUsageCount(tag.id);

	if (usageCount === 0) {
		// Tag is not used, delete directly
		await performTagDeletion(tag.id);
	} else {
		// Tag is used, show confirmation modal
		showTagDeleteConfirmationModal(tag, usageCount);
	}
}

// Get tag usage count
async function getTagUsageCount(tagId) {
	try {
		// Call db.js function
		return await window.getTagUsageCount(tagId);
	} catch (error) {
		console.error('Error in getTagUsageCount:', error);
		throw error;
	}
}

// Perform actual tag deletion
async function performTagDeletion(tagId) {
	try {
	// Remove tag from all notes first
		await window.removeTagFromAllNotes(tagId);

			// Now delete the tag itself
		await window.deleteTagById(tagId);

				showNotification('Etiket başarıyla silindi!', 'success');
				await updateSidebarCounts();

				if (currentView === 'tags') {
					await showTags();
				}
		} catch (error) {
		console.error('Error in performTagDeletion:', error);
		showNotification('Etiket silinirken hata oluştu!', 'error');
		throw error;
		}
}

// Show tag delete confirmation modal
function showTagDeleteConfirmationModal(tag, usageCount) {
	// Create modal if it doesn't exist
	let modal = document.getElementById('tag-delete-confirmation-modal');
	if (!modal) {
		modal = document.createElement('div');
		modal.id = 'tag-delete-confirmation-modal';
		modal.className = 'modal-overlay d-none';
		modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Etiket Silme Onayı</h3>
          <button class="modal-close" onclick="closeTagDeleteConfirmationModal()">
            <i class="bi bi-x"></i>
          </button>
        </div>
        <div class="modal-body">
          <p id="tag-delete-message"></p>
          <p class="modal-warning">Bu işlem geri alınamaz!</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-cancel" onclick="closeTagDeleteConfirmationModal()">
            İptal
          </button>
          <button class="modal-btn modal-btn-danger" onclick="confirmTagDeletion()">
            Etiketi Sil
          </button>
        </div>
      </div>
    `;
		document.body.appendChild(modal);
	}

	// Update message
	const messageElement = document.getElementById('tag-delete-message');
	if (messageElement) {
		messageElement.innerHTML = `Sildiğiniz etiket "${tag.name}" ${usageCount} adet notta tanımlı.</br>Notlar silinmeyecek, sadece ilgili etiket kaldırılacaktır.</br>Onaylıyor musunuz?`;
	}

	// Store tag for confirmation
	window.tagToDelete = tag;

	// Show modal
	modal.classList.remove('d-none');
	modal.classList.add('d-flex');
}

// Close tag delete confirmation modal
function closeTagDeleteConfirmationModal() {
	const modal = document.getElementById('tag-delete-confirmation-modal');
	if (modal) {
		modal.classList.add('d-none');
		modal.classList.remove('d-flex');
	}
	window.tagToDelete = null;
}

// Confirm tag deletion
async function confirmTagDeletion() {
	if (window.tagToDelete) {
		await performTagDeletion(window.tagToDelete.id);
		closeTagDeleteConfirmationModal();
	}
}

// Make functions globally available
window.closeTagDeleteConfirmationModal = closeTagDeleteConfirmationModal;
window.confirmTagDeletion = confirmTagDeletion;

// Show trash notes
async function showTrash() {
	currentView = 'trash';
	updateNotesHeaderTitle('Notlar');
	clearEditor();

	// Editor panelini devre dışı bırak
	const editorPanel = document.querySelector('.editor-panel');
	if (editorPanel) {
		editorPanel.classList.add('disabled');
	}

	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			includeDeleted: true,
			onlyDeleted: true,
			sortBy: currentSortOption,
			sortDirection: currentSortDirection
		});

			await displayNotes(notes);

			// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in showTrash:', error);
		throw error;
	}
}

async function getNoteById(id) {
	try {
		// Call db.js function
		return await window.getNoteById(id);
	} catch (error) {
		console.error('Error in getNoteById:', error);
		throw error;
	}
}

async function loadNote(id) {
	try {
		// Call db.js to get the note
		const note = await window.getNoteById(id);
		
		if (note) {
				// Mevcut not ID'sini ayarla
				currentNoteId = id;

				// Önceki seçili not'un class'ını kaldır
				document.querySelectorAll('.note-card.selected').forEach(card => {
					card.classList.remove('selected');
				});

				// Yeni seçili not'a class ekle
				const selectedCard = document.querySelector(`[onclick="loadNote(${id})"]`);
				if (selectedCard) {
					selectedCard.classList.add('selected');
				}

				$('note-title').value = note.title || '';

			// Content'i yükle
				const content = note.content || '';

				// Checklist'i temizle ve verilerini yükle
				const checklist = document.getElementById('checklist');
			checklist.innerHTML = '';

				if (note.checklistData) {
					try {
						checklistItems = JSON.parse(note.checklistData);
						renderChecklistItems();
					} catch (error) {
						checklistItems = [];
					}
				} else {
					checklistItems = [];
				}

				// Editor'ü açık olarak ayarla ve checklist'i gizle
				const editorElement = document.getElementById('editor');
				editorElement.style.display = 'block';
				checklist.style.display = 'none';

				// Background color'ı yükle
				const noteBgColorBtn = document.getElementById('noteBgColorPopupBtn');
				if (note.bgColor) {
					document.getElementById('editor-control').style.backgroundColor = note.bgColor;
					document.getElementById('note-metadata-container').style.backgroundColor = note.bgColor;

					if (noteBgColorBtn) {
						noteBgColorBtn.classList.add('has-bg-color');
					}
				} else {
					document.getElementById('editor-control').style.backgroundColor = '';
					document.getElementById('note-metadata-container').style.backgroundColor = '';

					if (noteBgColorBtn) {
						noteBgColorBtn.classList.remove('has-bg-color');
					}
				}

				// Due date'i yükle
				currentNoteDueDate = note.dueDate || null;
				updateDueDateDisplay();

				// Reminder'ı yükle
				currentNoteReminderDateTime = note.reminderDateTime || null;
				updateReminderDisplay();

				// Parent note'u yükle
				currentParentNoteId = note.parentNoteId || null;
				updateParentNoteDisplay();

				// Folder'ı yükle
				currentFolderId = note.folderId || null;
				updateFolderDisplay();

				// Tag'ları yükle
				currentTagIds = note.tags ? note.tags.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
				updateTagDisplay();

				// Editor'ü temizlemeden önce yeni içeriği hazırla ve tek seferde yükle
				window.editor.commands.setContent(content, false);

				// Focus ve sayaç güncelleme
				setTimeout(() => {
					window.editor.commands.focus();
					updateEditorCounter();
					updateCommentsButton();
					updateNavigationButtons();
				}, 50);
			} else {
			throw new Error('Note not found');
		}
	} catch (error) {
		console.error('Error in loadNote:', error);
		throw error;
	}
}

// Yeni not oluştur
function createNewNote() {
	// Eğer tags view'da isek yeni etiket modal'ını aç
	if (currentView === 'tags') {
		openNewTagModal();
		return;
	}

	// Eğer folders view'da isek yeni klasör modal'ını aç
	if (currentView === 'folders') {
		openNewFolderModal();
		return;
	}

	clearEditor();

	// Tüm seçili not'ların class'ını kaldır
	document.querySelectorAll('.note-card.selected').forEach(card => {
		card.classList.remove('selected');
	});

	// Comments button'u temizle
	const commentsBtn = document.getElementById('commentsBtn');
	if (commentsBtn) {
		commentsBtn.classList.remove('has-comments');
	}

	// Due date button'u temizle
	const dueDateBtn = document.getElementById('dueDateBtn');
	if (dueDateBtn) {
		dueDateBtn.classList.remove('has-due-date');
	}

	// Reminder button'u temizle
	const reminderBtn = document.getElementById('reminderBtn');
	if (reminderBtn) {
		reminderBtn.classList.remove('has-reminder');
	}

	// Checklist button'u temizle
	const checklistBtn = document.getElementById('checklistBtn');
	if (checklistBtn) {
		checklistBtn.classList.remove('has-checklist');
	}

	// Parent note button'u temizle
	const parentNoteBtn = document.getElementById('parent-note-btn');
	if (parentNoteBtn) {
		parentNoteBtn.classList.remove('has-parent-note');
	}

	$('note-title').focus();
}

// Bildirim gösterme fonksiyonu
function showNotification(message, type = 'info') {
	// Mevcut bildirimi kaldır
	const existingNotification = document.querySelector('.notification');
	if (existingNotification) {
		existingNotification.remove();
	}

	// Yeni bildirim oluştur
	const notification = document.createElement('div');
	notification.className = `notification notification-${type}`;
	notification.innerHTML = `
    <div class="notification-content">
      <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close" onclick="closeNotification(this)">
      <i class="bi bi-x"></i>
    </button>
  `;

	// Body'ye ekle
	document.body.appendChild(notification);

	// Animasyon için kısa gecikme
	setTimeout(() => {
		notification.classList.add('show');
	}, 100);

	// 3 saniye sonra kaldır
	setTimeout(() => {
		notification.classList.remove('show');
		setTimeout(() => {
			if (notification.parentNode) {
				notification.remove();
			}
		}, 300);
	}, 3000);
}

// Bildirimi kapatma fonksiyonu
function closeNotification(button) {
	const notification = button.closest('.notification');
	if (notification) {
		notification.classList.remove('show');
		setTimeout(() => {
			if (notification.parentNode) {
				notification.remove();
			}
		}, 300);
	}
}

// Yorumları kopyalama fonksiyonu
async function copyNoteComments(originalNoteId, newNoteId) {
	try {
		// Call db.js function
		return await window.copyComments(originalNoteId, newNoteId);
			} catch (error) {
		console.error('Error in copyNoteComments:', error);
		throw error;
			}
}

// Not kopyalama fonksiyonu
async function copyNote(id) {
	try {
		// Get original note
		const originalNote = await window.getNoteById(id);
		if (!originalNote) {
			throw new Error('Note not found');
		}

				const now = new Date().toISOString();

		// Create copied note
				const copiedNote = {
					title: `(copy) ${originalNote.title}`,
					content: originalNote.content,
					checklistData: originalNote.checklistData || null,
					bgColor: originalNote.bgColor || '',
					dueDate: originalNote.dueDate || null,
					reminderDateTime: originalNote.reminderDateTime || null,
					parentNoteId: originalNote.parentNoteId || null,
					folderId: originalNote.folderId || null,
					tags: originalNote.tags || '',
					createdAt: now,
					updatedAt: now,
					isFavorite: false,
					isArchived: false,
					isDeleted: false
				};

		// Save copied note
		const newNoteId = await window.createNote(copiedNote);

		// Copy comments
					try {
						await copyNoteComments(id, newNoteId);
					} catch (error) {
						console.error('Error copying comments:', error);
					}

		// UI updates
		await reloadCurrentView();
		await updateSidebarCounts();
					showNotification('Not başarıyla kopyalandı!', 'success');
		
		return newNoteId;
	} catch (error) {
		console.error('Error in copyNote:', error);
		throw error;
	}
}

// Editor sayaç fonksiyonu
function updateEditorCounter() {
	const content = editor.getText();
	const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
	const charCount = content.length;

	document.getElementById('word-count').textContent = `${wordCount} kelime`;
	document.getElementById('char-count').textContent = `${charCount} karakter`;
}

// Panel divider sürükleme fonksiyonu
function initPanelResizer() {
	const divider = document.getElementById('panel-divider');
	const notesPanel = document.querySelector('.notes-panel');
	const editorPanel = document.querySelector('.editor-panel');

	// Load saved panel width from localStorage
	const savedWidth = localStorage.getItem('noteflix-notes-panel-width');
	if (savedWidth) {
		const width = parseInt(savedWidth);
		if (width >= 300 && width <= 600) {
			notesPanel.style.width = width + 'px';
		}
	}

	let isResizing = false;

	divider.addEventListener('mousedown', (e) => {
		isResizing = true;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';

		const startX = e.clientX;
		const startWidth = notesPanel.offsetWidth;

		function handleMouseMove(e) {
			if (!isResizing) return;

			const deltaX = e.clientX - startX;
			const newWidth = startWidth + deltaX;
			const minWidth = 300;
			const maxWidth = 600;

			if (newWidth >= minWidth && newWidth <= maxWidth) {
				notesPanel.style.width = newWidth + 'px';
			}
		}

		function handleMouseUp() {
			isResizing = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';

			// Save current panel width to localStorage
			const currentWidth = notesPanel.offsetWidth;
			localStorage.setItem('noteflix-notes-panel-width', currentWidth.toString());

			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	});
}

// Global scope'a ekle
window.loadNote = loadNote;
window.createNewNote = createNewNote;
window.showNotification = showNotification;
window.closeNotification = closeNotification;
window.copyNote = copyNote;
window.updateEditorCounter = updateEditorCounter;
window.initPanelResizer = initPanelResizer;
window.restoreNote = restoreNote;

// Silinen notu üst not olarak kullanan diğer notların parentNoteId'sini temizle
async function clearParentNoteReferences(deletedNoteId) {
	try {
		// Call db.js to clear parent note references
		const updatedCount = await window.clearParentNoteReferences(deletedNoteId);
		return updatedCount;
	} catch (error) {
		console.error('Error in clearParentNoteReferences:', error);
		throw error;
	}
}

async function deleteNote(id) {
	try {
		// Call db.js to soft delete the note
		const note = await window.deleteNoteById(id);
		
		// Clear parent note references
		await window.clearParentNoteReferences(id);

		// UI updates
		await reloadCurrentView();
		await updateSidebarCounts();

					if (currentNoteId === id) {
						clearEditor();
					}

					updateNavigationButtons();
					showNotification(`${note.title} çöp kutusuna gönderildi!`, 'success');
	} catch (error) {
		console.error('Error in deleteNote:', error);
		throw error;
	}
}

// Kalıcı olarak not silme fonksiyonu - modal açar
async function permanentDeleteNote(id) {

	// Not bilgisini al
	const note = await getNoteById(id);
	if (!note) {
		showNotification('Not bulunamadı!', 'error');
		return;
	}

	// Modal mesajını güncelle
	const messageElement = document.getElementById('single-note-permanent-delete-message');
	if (messageElement) {
		messageElement.textContent = `"${note.title}" notu kalıcı olarak silinecektir. Emin misiniz?`;
	}

	// Silinecek not ID'sini sakla
	singleNoteToDelete = id;

	// Modal'ı göster
	const modal = document.getElementById('single-note-permanent-delete-modal');
	if (modal) {
		modal.classList.remove('d-none');
		modal.classList.add('d-flex');
	}
}

async function restoreNote(id) {
	try {
		// Call db.js to restore the note
		const note = await window.restoreNoteById(id);

		// UI updates
		await reloadCurrentView();
		await updateSidebarCounts();
					showNotification(`${note.title} çöp kutusundan geri alındı!`, 'success');
	} catch (error) {
		console.error('Error in restoreNote:', error);
		throw error;
	}
}

async function displayNotes(notes, searchTerm = '') {
	const notesList = document.querySelector('.notes-list');
	if (!notesList) return;

	if (notes.length === 0) {
		const message = searchTerm ? `"${searchTerm}" için sonuç bulunamadı.` : 'Listede not yer almıyor.';
		notesList.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${message}</p>`;
		return;
	}

	// Her not için klasör bilgisini al
	const notesWithFolders = await Promise.all(notes.map(async (note) => {
		let folderInfo = null;
		if (note.folderId) {
			try {
				const folder = await getFolderById(note.folderId);
				if (folder) {
					folderInfo = {
						name: folder.name || 'Başlıksız Klasör',
						bgColor: folder.bgColor,
						fontColor: folder.fontColor
					};
				}
			} catch (error) {
				console.error('Error loading folder for note:', error);
			}
		}
		return {
			...note,
			folderInfo
		};
	}));

	notesList.innerHTML = notesWithFolders.map(note => {
		let title = note.title;
		let preview = (note.content || '').replace(/<[^>]*>/g, '').substring(0, noteListPreviewLength);

		// Arama terimini vurgula
		/*if (searchTerm) {
		  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
		  title = title.replace(regex, '<mark>$1</mark>');
		  preview = preview.replace(regex, '<mark>$1</mark>');
		}*/

		return `
      <div class="note-card" onclick="loadNote(${note.id})" oncontextmenu="showContextMenu(event, ${note.id})" style="${note.bgColor ? `background-color: ${note.bgColor};` : ''}">
        <div class="note-header">
          <h4 class="note-title">
            ${note.reminderDateTime && new Date(note.reminderDateTime) > new Date() ? '<i class="bi bi-bell-fill reminder-bell"></i>' : ''}${note.isFavorite ? '<i class="bi bi-star-fill favorite-star"></i>' : ''}${title}
          </h4>
        </div>
        <p class="note-preview">
          ${preview}...
        </p>
        <div class="note-meta">
          <div class="note-date">
            ${new Date(note.updatedAt).toLocaleString('tr-TR', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          <div class="note-actions">
            ${note.folderInfo ? `
              <div class="note-folder" style="${note.folderInfo.bgColor ? `background-color: ${note.folderInfo.bgColor};` : ''}${note.folderInfo.fontColor ? ` color: ${note.folderInfo.fontColor};` : ''}">
                <i class="bi bi-folder2"></i>
                <span>${note.folderInfo.name.length > 20 ? note.folderInfo.name.substring(0, 20) + '...' : note.folderInfo.name}</span>
              </div>
            ` : ''}
            ${note.dueDate ? `
              <div class="note-due-date ${new Date(note.dueDate) < new Date() ? 'overdue' : ''}">
                <i class="bi bi-calendar-event"></i>
                <span>${new Date(note.dueDate).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
	}).join('');
}

// Save note button event listener
$('save-note-btn').addEventListener('click', async () => {
	try {
		await saveNote();
	} catch (error) {
		console.error('Error saving note:', error);
		alert('Not kaydedilirken hata oluştu: ' + error.message);
	}
});

// Archive note function
async function archiveNote(id) {
	try {
		// Call db.js to archive the note
		const note = await window.archiveNoteById(id);

		// UI updates
		await reloadCurrentView();
		await updateSidebarCounts();

					if (currentNoteId === id) {
						clearEditor();
					}

					showNotification(`${note.title} arşive gönderildi!`, 'success');
	} catch (error) {
		console.error('Error in archiveNote:', error);
		throw error;
	}
}

// Unarchive note function
async function unarchiveNote(id) {
	try {
		// Call db.js to unarchive the note
		const note = await window.unarchiveNoteById(id);

		// UI updates
		await reloadCurrentView();
		await updateSidebarCounts();

					if (currentNoteId === id) {
						clearEditor();
					}

					showNotification(`${note.title} arşivden çıkarıldı!`, 'success');
	} catch (error) {
		console.error('Error in unarchiveNote:', error);
		throw error;
	}
}

// Update sidebar counts
async function updateSidebarCounts() {
	try {
		// Get all data from db.js functions
		const [notes, tags, folders] = await Promise.all([
			window.getAllNotesForCounting(),
			window.getAllTags(),
			window.getAllFolders()
		]);

		// Calculate counts
				const notesCount = notes.filter(note => note.isArchived !== true && note.isDeleted !== true).length;
				const favoritesCount = notes.filter(note => note.isFavorite === true && note.isArchived !== true && note.isDeleted !== true).length;
				const archiveCount = notes.filter(note => note.isArchived === true && note.isDeleted !== true).length;
		const remindersCount = notes.filter(note => note.reminderDateTime && !note.isDeleted).length;
				const trashCount = notes.filter(note => note.isDeleted === true).length;
					const tagsCount = tags.length;
						const foldersCount = folders.length;

		// Update HTML count elements
		updateCountElement('[data-action="notes"] .count', notesCount);
		updateCountElement('[data-action="favorites"] .count', favoritesCount);
		updateCountElement('[data-action="reminders"] .count', remindersCount);
		updateCountElement('[data-action="archive"] .count', archiveCount);
		updateCountElement('[data-action="tags"] .count', tagsCount);
		updateCountElement('[data-action="folders"] .count', foldersCount);
		updateCountElement('[data-action="trash"] .count', trashCount);

		} catch (error) {
		console.error('Error in updateSidebarCounts:', error);
		throw error;
		}
}

// Helper function to update count element
function updateCountElement(selector, count) {
	const countElement = document.querySelector(`.sidebar ${selector}`);
	if (countElement) {
		if (count === 0) {
			// 0 ise count'u gizle
			countElement.style.display = 'none';
		} else {
			// 0 değilse göster
			countElement.style.display = 'flex';
			countElement.textContent = count;
		}
	} else {
		console.error(`Could not find element with selector: .sidebar ${selector}`);
	}
}

// Load favorite notes only
async function loadFavoriteNotes() {
	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			onlyFavorites: true,
			sortBy: currentSortOption,
			sortDirection: currentSortDirection
		});

			await displayNotes(notes);

			// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in loadFavoriteNotes:', error);
		throw error;
	}
}

// Load archived notes only
async function loadArchivedNotes() {
	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			onlyArchived: true,
			sortBy: currentSortOption,
			sortDirection: currentSortDirection
		});

			await displayNotes(notes);

			// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in loadArchivedNotes:', error);
		throw error;
	}
}

async function loadDeletedNotes() {
	try {
		// Use db.js getNotesWithFilters function
		const notes = await getNotesWithFilters({
			includeDeleted: true,
			onlyDeleted: true,
			sortBy: currentSortOption,
			sortDirection: currentSortDirection
		});

			await displayNotes(notes);

		// Apply view preferences after notes are displayed
			setTimeout(() => {
				applyViewPreferences();
			}, 100);

		return notes;
	} catch (error) {
		console.error('Error in loadDeletedNotes:', error);
		throw error;
	}
}

// Update active nav item
function updateActiveNavItem(activeIndex) {
	// Remove active class from all nav items
	document.querySelectorAll('.nav-item').forEach(item => {
		item.classList.remove('active');
	});

	// Add active class to clicked item
	const navItems = document.querySelectorAll('.nav-item');
	if (navItems[activeIndex]) {
		navItems[activeIndex].classList.add('active');
	}
}

// Debug function to check database content
async function debugDatabase() {
	try {
		// Call db.js function
		return await window.getAllNotes();
	} catch (error) {
		console.error('Error in debugDatabase:', error);
		throw error;
	}
}


// Reload current view based on active view state
async function reloadCurrentView() {

	switch (currentView) {
		case 'notes':
			await loadNotes();
			break;
		case 'favorites':
			await loadFavoriteNotes();
			break;
		case 'archive':
			await loadArchivedNotes();
			break;
		case 'reminders':
			break;
		case 'trash':
			await loadDeletedNotes();
			break;
		default:
			await loadNotes();
			break;
	}
}

// Make functions globally available
window.deleteNote = deleteNote;
window.loadNote = loadNote;
window.showContextMenu = showContextMenu;
window.archiveNote = archiveNote;
window.unarchiveNote = unarchiveNote;
window.updateSidebarCounts = updateSidebarCounts;
window.loadFavoriteNotes = loadFavoriteNotes;
window.loadArchivedNotes = loadArchivedNotes;
window.updateActiveNavItem = updateActiveNavItem;
window.debugDatabase = debugDatabase;
window.reloadCurrentView = reloadCurrentView;
window.clearEditor = clearEditor;
window.permanentDeleteAllNotes = permanentDeleteAllNotes;
window.closePermanentDeleteModal = closePermanentDeleteModal;
window.confirmPermanentDelete = confirmPermanentDelete;
window.closeSingleNotePermanentDeleteModal = closeSingleNotePermanentDeleteModal;
window.confirmSingleNotePermanentDelete = confirmSingleNotePermanentDelete;
window.closeCommentDeleteModal = closeCommentDeleteModal;
window.confirmCommentDelete = confirmCommentDelete;
window.closeNewFolderModal = closeNewFolderModal;
window.saveNewFolder = saveNewFolder;
window.closeNewTagModal = closeNewTagModal;
window.saveNewTag = saveNewTag;
window.closeTagModal = closeTagModal;
window.confirmTagSelection = confirmTagSelection;
window.removeSelectedTag = removeSelectedTag;
window.removeTagFromNote = removeTagFromNote;

// Global click handler for context menu and popups (bubble phase)
document.addEventListener('click', function(e) {
	// Don't hide context menu if clicking on a context menu item
	if (e.target.classList.contains('context-item')) {
		return;
	}

	const contextMenu = document.getElementById('context-menu');
	if (contextMenu && !contextMenu.classList.contains('d-none')) {
		hideContextMenu();
	}

	// Close popups when clicking outside
	const popups = [headingPopup, listPopup, alignPopup, palettePopup, actionsPopup, urlPopup, videoPopup, imagePopup, textPopup, bgPopup, noteBgPopup, commandPopup, listOptionsPopup, sortOptionsPopup];

	popups.forEach(popup => {
		if (popup && !popup.classList.contains('d-none')) {
			const isClickInsidePopup = popup.contains(e.target);
			// Trigger button kontrolü - popup'ın önceki element'i değil, button'ın kendisi
			const isClickOnTrigger = e.target.id === 'heading-btn' ||
				e.target.id === 'list-btn' ||
				e.target.id === 'align-btn' ||
				e.target.id === 'palette-btn' ||
				e.target.id === 'actions-btn' ||
				e.target.id === 'url-btn' ||
				e.target.id === 'video-btn' ||
				e.target.id === 'image-btn' ||
				e.target.id === 'list-options-btn' ||
				e.target.id === 'sort-btn' ||
				e.target.id === 'noteBgColorPopupBtn';

			if (!isClickInsidePopup && !isClickOnTrigger) {
				closePopup(popup);
			}
		}
	});
}, true);

// Toggle notes panel visibility
function toggleNotesPanel() {
	const sidebar = document.querySelector('.sidebar');
	const notesPanel = document.querySelector('.notes-panel');
	const resizeBtn = document.getElementById('resizeBtn');
	const resizeIcon = resizeBtn.querySelector('i');

	if (notesPanel) {
		// Inline style width'i kontrol et
		const inlineWidth = notesPanel.style.width;

		if (inlineWidth === '0px') {
			// Aç
			notesPanel.style.width = '400px';
			notesPanel.style.opacity = '1';
			sidebar.style.width = '240px';
			sidebar.style.opacity = '1';
			if (resizeIcon) resizeIcon.className = 'bi bi-arrows-angle-expand';
		} else {
			// Kapat
			notesPanel.style.width = '0px';
			notesPanel.style.opacity = '0';
			sidebar.style.width = '0px';
			sidebar.style.opacity = '0';
			if (resizeIcon) resizeIcon.className = 'bi bi-arrows-angle-contract';
		}
	}
}

// Context Menu Functions
let currentNoteId = null;

async function toggleFavorite(noteId) {
	try {
		// Call db.js to toggle favorite
		const note = await window.toggleNoteFavoriteById(noteId);

		// UI updates
		await reloadCurrentView();
		await updateSidebarCounts();

				if (note.isFavorite) {
					showNotification(`${note.title} favorilere eklendi!`, 'success');
				} else {
					showNotification(`${note.title} favorilerden çıkarıldı!`, 'info');
				}
	} catch (error) {
		console.error('Error in toggleFavorite:', error);
		throw error;
	}
}

async function updateContextMenuText(noteId) {
	try {
		// Call db.js to get note data
		const note = await window.getNoteById(noteId);
		
		if (note) {
				// Get all context menu items (specifically from context-menu)
				const contextMenu = document.getElementById('context-menu');
				const copyItem = contextMenu.querySelector('[data-action="copy"]');
				const favoriteItem = contextMenu.querySelector('[data-action="favorite"]');
				const archiveItem = contextMenu.querySelector('[data-action="archive"]');
				const deleteItem = contextMenu.querySelector('[data-action="delete"]');
				const permanentDeleteItem = contextMenu.querySelector('[data-action="permanent-delete"]');

				if (note.isDeleted) {

					// Çöp kutusundaki notlar için "Çöp Kutusundan Çıkar" ve "Kalıcı Olarak Sil" göster
					if (copyItem) {
						copyItem.style.display = 'none';
						copyItem.classList.add('d-none');
					}
					if (favoriteItem) {
						favoriteItem.style.display = 'none';
						favoriteItem.classList.add('d-none');
					}
					if (archiveItem) {
						// Multiple methods to hide the archive item
						archiveItem.style.display = 'none';
						archiveItem.classList.add('d-none');
					}
					if (deleteItem) {
						deleteItem.style.display = 'flex';
						deleteItem.classList.remove('d-none');
						const deleteSpan = deleteItem.querySelector('span');
						if (deleteSpan) {
							deleteSpan.textContent = 'Çöp Kutusundan Çıkar';
						}
					}
					if (permanentDeleteItem) {
						permanentDeleteItem.style.display = 'flex';
						permanentDeleteItem.classList.remove('d-none');
					}
				} else if (currentSidebarView === 'archive') {

					// Arşiv görünümündeki notlar için sadece "Arşivden Çıkar" göster
					if (copyItem) {
						copyItem.style.display = 'none';
						copyItem.classList.add('d-none');
					}
					if (favoriteItem) {
						favoriteItem.style.display = 'none';
						favoriteItem.classList.add('d-none');
					}
					if (archiveItem) {
						archiveItem.style.display = 'flex';
						archiveItem.classList.remove('d-none');
						const archiveSpan = archiveItem.querySelector('span');
						if (archiveSpan) {
							archiveSpan.textContent = 'Arşivden Çıkar';
						}
					}
					if (deleteItem) {
						deleteItem.style.display = 'none';
						deleteItem.classList.add('d-none');
					}
					if (permanentDeleteItem) {
						permanentDeleteItem.style.display = 'none';
						permanentDeleteItem.classList.add('d-none');
					}
				} else {
					// Normal notlar için tüm seçenekleri göster
					if (copyItem) {
						copyItem.style.display = 'flex';
						copyItem.classList.remove('d-none');
					}
					if (favoriteItem) {
						favoriteItem.style.display = 'flex';
						favoriteItem.classList.remove('d-none');
						const favoriteSpan = favoriteItem.querySelector('span');
						if (favoriteSpan) {
							favoriteSpan.textContent = note.isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle';
						}
					}
					if (archiveItem) {
						archiveItem.style.display = 'flex';
						archiveItem.classList.remove('d-none');
						archiveItem.style.visibility = 'visible';
						archiveItem.style.height = 'auto';
						archiveItem.style.padding = '';
						archiveItem.style.margin = '';
						archiveItem.style.opacity = '1';
						archiveItem.style.position = 'static';
						archiveItem.style.left = 'auto';
						const archiveSpan = archiveItem.querySelector('span');
						if (archiveSpan) {
							archiveSpan.textContent = note.isArchived ? 'Arşivden Çıkar' : 'Arşive Gönder';
						}
					} else {
						// If archive item was removed, restore it
						const contextMenu = document.getElementById('context-menu');
						const deleteItem = document.querySelector('[data-action="delete"]');
						if (contextMenu && deleteItem) {
							const archiveItem = document.createElement('div');
							archiveItem.className = 'context-item';
							archiveItem.setAttribute('data-action', 'archive');
							archiveItem.innerHTML = `
                <i class="bi bi-archive"></i>
                <span>${note.isArchived ? 'Arşivden Çıkar' : 'Arşive Gönder'}</span>
              `;
							contextMenu.insertBefore(archiveItem, deleteItem);
						}
					}
					if (deleteItem) {
						deleteItem.style.display = 'flex';
						const deleteSpan = deleteItem.querySelector('span');
						if (deleteSpan) {
							deleteSpan.textContent = 'Sil';
						}
					}
					if (permanentDeleteItem) {
						permanentDeleteItem.style.display = 'none';
					}
				}
			} else {
			throw new Error('Note not found');
		}
	} catch (error) {
		console.error('Error in updateContextMenuText:', error);
		throw error;
	}
}

async function showContextMenu(event, noteId) {
	event.preventDefault();

	// Store the context menu note ID for use in actions
	window.contextMenuNoteId = noteId;

	// Reset all context menu items to default state first
	const contextMenu = document.getElementById('context-menu');
	const copyItem = contextMenu.querySelector('[data-action="copy"]');
	const favoriteItem = contextMenu.querySelector('[data-action="favorite"]');
	const archiveItem = contextMenu.querySelector('[data-action="archive"]');
	const deleteItem = contextMenu.querySelector('[data-action="delete"]');
	const permanentDeleteItem = contextMenu.querySelector('[data-action="permanent-delete"]');

	// Reset to default display state
	if (copyItem) {
		copyItem.style.display = 'flex';
		copyItem.classList.remove('d-none');
	}
	if (favoriteItem) {
		favoriteItem.style.display = 'flex';
		favoriteItem.classList.remove('d-none');
	}
	if (archiveItem) {
		archiveItem.style.display = 'flex';
		archiveItem.classList.remove('d-none');
	}
	if (deleteItem) {
		deleteItem.style.display = 'flex';
		deleteItem.classList.remove('d-none');
	}
	if (permanentDeleteItem) {
		permanentDeleteItem.style.display = 'none';
		permanentDeleteItem.classList.add('d-none');
	}

	// Update context menu text based on note's favorite status BEFORE showing
	try {
		await updateContextMenuText(noteId);
	} catch (error) {
		console.error('Error updating context menu:', error);
	}

	// Now show the context menu with updated content
	// Önce menu'yu görünür yap ki boyutunu hesaplayabilelim
	contextMenu.classList.remove('d-none');

	// Menu boyutlarını al
	const menuRect = contextMenu.getBoundingClientRect();
	const menuWidth = menuRect.width;
	const menuHeight = menuRect.height;

	// Ekran boyutlarını al
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;

	// Başlangıç pozisyonları
	let left = event.pageX;
	let top = event.pageY;

	// Sağdan taşma kontrolü
	if (left + menuWidth > viewportWidth) {
		left = event.pageX - menuWidth;
	}

	// Alttan taşma kontrolü
	if (top + menuHeight > viewportHeight) {
		top = event.pageY - menuHeight;
	}

	// Sol sınır kontrolü
	if (left < 0) {
		left = 10; // Küçük bir margin
	}

	// Üst sınır kontrolü
	if (top < 0) {
		top = 10; // Küçük bir margin
	}

	// Pozisyonu ayarla
	contextMenu.style.left = left + 'px';
	contextMenu.style.top = top + 'px';
}

function hideContextMenu() {
	const contextMenu = document.getElementById('context-menu');
	contextMenu.classList.add('d-none');
	window.contextMenuNoteId = null; // Clear the context menu note ID
	window.contextMenuTag = null; // Clear the context menu tag
}

async function handleContextAction(action) {
	if (!window.contextMenuNoteId) return;

	const noteId = window.contextMenuNoteId;

	switch (action) {
		case 'copy':
			await copyNote(noteId);
			break;
		case 'delete':
			// Check if note is deleted to determine action
			try {
				const note = await window.getNoteById(noteId);
				if (note) {
						if (note.isDeleted) {
							await restoreNote(noteId);
						} else {
							await deleteNote(noteId);
						}
					}
			} catch (error) {
				console.error('Error in delete action:', error);
			}
			hideContextMenu();
			return;
		case 'favorite':
			await toggleFavorite(noteId);
			break;
		case 'archive':
			// Check if note is archived to determine action
			try {
				const note = await window.getNoteById(noteId);
				if (note) {
						if (note.isArchived) {
							await unarchiveNote(noteId);
						} else {
							await archiveNote(noteId);
						}
					}
			} catch (error) {
				console.error('Error in archive action:', error);
			}
			hideContextMenu();
			return;
		case 'permanent-delete':
			await permanentDeleteNote(noteId);
			hideContextMenu();
			break;
	}

	hideContextMenu();
}

// Event listeners moved to after color definitions (line 3186)
// Old event listener code removed - now handled after color definitions

// Initialize database and load notes on page load
window.addEventListener('load', async () => {
	try {
		await initDB();

		// Set panel width from localStorage immediately
		const savedWidth = localStorage.getItem('noteflix-notes-panel-width');
		if (savedWidth) {
			const width = parseInt(savedWidth);
			if (width >= 300 && width <= 600) {
				document.documentElement.style.setProperty('--notes-panel-width', width + 'px');
			}
		}

		// Initialize panel resizer first (synchronous now)
		initPanelResizer();

		await loadNotes();
		await updateSidebarCounts(); // Sidebar adetlerini güncelle

		// Load view preferences after notes are loaded
		loadViewPreferences();

		// Initialize save button state and permanent delete button visibility
		updateSaveButtonState();
		updatePermanentDeleteButtonVisibility();

		// Request notification permission
		requestNotificationPermission();

		// Start reminder checking
		startReminderChecking();

		// Initialize checklist event delegation
		initChecklistEventDelegation();

		// Initialize navigation buttons
		updateNavigationButtons();
	} catch (error) {
		console.error('Error initializing database:', error);
	}
});

/* ---------- Checklist Functions ---------- */
// Checklist state management
let checklistItems = [];

// Event delegation for checklist
function initChecklistEventDelegation() {
	const checklist = document.getElementById('checklist');

	// Keydown event delegation
	checklist.addEventListener('keydown', function(event) {
		if (event.target.matches('input[type="text"]')) {
			const itemId = parseInt(event.target.closest('.checklist-item').dataset.id);
			handleChecklistKeydown(event, itemId);
		}
	});

	// Change event delegation for checkboxes
	checklist.addEventListener('change', function(event) {
		if (event.target.matches('input[type="checkbox"]')) {
			const itemId = parseInt(event.target.closest('.checklist-item').dataset.id);
			toggleChecklistItem(itemId);
		}
	});
}

// Handle enter key in checklist items
window.handleChecklistKeydown = function(event, itemId) {
	if (event.key === 'Enter') {
		event.preventDefault();
		const input = event.target;
		const text = input.value.trim();

		// Update current item
		const itemIndex = checklistItems.findIndex(item => item.id === itemId);
		if (itemIndex !== -1) {
			checklistItems[itemIndex].text = text;
		}

		// Add new item
		addChecklistItem();
	} else if (event.key === 'Backspace' && event.target.value === '') {
		// Delete empty item (except if it's the only one)
		if (checklistItems.length > 1) {
			event.preventDefault();
			removeChecklistItem(itemId);
		}
	}
};

// Toggle checklist item completion
window.toggleChecklistItem = function(itemId) {
	const itemIndex = checklistItems.findIndex(item => item.id === itemId);
	if (itemIndex !== -1) {
		checklistItems[itemIndex].completed = !checklistItems[itemIndex].completed;

		const itemElement = document.querySelector(`[data-id="${itemId}"]`);
		if (checklistItems[itemIndex].completed) {
			itemElement.classList.add('completed');
		} else {
			itemElement.classList.remove('completed');
		}
	}
};

// checkListBtn click handler
document.getElementById('checklistBtn').onclick = () => {
	toggleChecklistView();
};

// Navigation button click handlers
document.querySelector('.previous-note').onclick = () => {
	navigateToPreviousNote();
};

document.querySelector('.next-note').onclick = () => {
	navigateToNextNote();
};

// dueDateBtn click handler - SimpleDTP modal
document.getElementById('dueDateBtn').onclick = () => {
	// SimpleDTP modal oluştur
	const dp = SimpleDTP.create({
		title: 'Hedef Tarih',
		locale: 'tr',
		enableTime: false,
		format: 'dd.MM.yyyy',
		showToday: false,
		showCancel: false,
		closeOnOverlayClick: true,
		mode: 'modal',
		value: currentNoteDueDate ? new Date(currentNoteDueDate) : null,
		onConfirm: (date, str) => {
			// Seçilen tarihi global değişkene kaydet
			currentNoteDueDate = date.toISOString();
			updateDueDateDisplay(true); // autoSave = true
		}
	});

	// Modal'ı aç
	dp.open();
};

// reminderBtn click handler - SimpleDTP modal with time
document.getElementById('reminderBtn').onclick = () => {
	// SimpleDTP modal oluştur
	const dp = SimpleDTP.create({
		title: 'Hatırlatıcı',
		locale: 'tr',
		enableTime: true,
		timeStep: 1, // 1 dakika periyot
		format: 'dd.MM.yyyy HH:mm',
		showToday: false,
		showCancel: false,
		closeOnOverlayClick: true,
		mode: 'modal',
		value: currentNoteReminderDateTime ? new Date(currentNoteReminderDateTime) : null,
		onConfirm: (date, str) => {
			// Geçmiş tarih kontrolü
			const now = new Date();
			if (date <= now) {
				showNotification('Geçmiş tarihe hatırlatıcı eklenemez!', 'error');
				return;
			}

			// Seçilen tarihi global değişkene kaydet
			currentNoteReminderDateTime = date.toISOString();
			updateReminderDisplay(true); // autoSave = true
		}
	});

	// Modal'ı aç
	dp.open();
};

// Clear due date button click handler
document.getElementById('clear-due-date-btn').onclick = (e) => {
	e.stopPropagation();

	// Tarihi temizle
	currentNoteDueDate = null;
	updateDueDateDisplay();

	// Otomatik kaydet (eğer bir not açıksa)
	if (currentNoteId) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after due date clear:', error);
		});
	}
};

// Clear reminder button click handler
document.getElementById('clear-reminder-btn').onclick = (e) => {
	e.stopPropagation();

	// Hatırlatıcıyı temizle
	currentNoteReminderDateTime = null;
	updateReminderDisplay();

	// Otomatik kaydet (eğer bir not açıksa)
	if (currentNoteId) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after reminder clear:', error);
		});
	}
};

// Parent note button click handler
document.getElementById('parent-note-btn').onclick = async () => {
	await openParentNoteModal();
};

document.getElementById('folderPopupBtn').onclick = async () => {
	await openFolderModal();
};

document.getElementById('tagPopupBtn').onclick = async () => {
	await openTagModal();
};

// Parent note search input event listener
document.getElementById('parent-note-search-input').addEventListener('input', (e) => {
	const searchTerm = e.target.value.toLowerCase();
	const noteList = document.getElementById('parent-note-list');
	const items = noteList.querySelectorAll('.parent-note-item');

	items.forEach(item => {
		const text = item.textContent.toLowerCase();
		if (text.includes(searchTerm)) {
			item.style.display = '';
		} else {
			item.style.display = 'none';
		}
	});
});

// Folder search input event listener
document.getElementById('folder-search-input').addEventListener('input', (e) => {
	const searchTerm = e.target.value.toLowerCase();
	const folderList = document.getElementById('folder-list');
	const items = folderList.querySelectorAll('.folder-item');

	items.forEach(item => {
		const text = item.textContent.toLowerCase();
		const title = item.title ? item.title.toLowerCase() : '';

		if (text.includes(searchTerm) || title.includes(searchTerm)) {
			item.style.display = '';
		} else {
			item.style.display = 'none';
		}
	});
});

// Tag search input event listener
document.getElementById('tag-search-input').addEventListener('input', (e) => {
	const searchTerm = e.target.value.toLowerCase();
	const tagList = document.getElementById('tag-list');
	const items = tagList.querySelectorAll('.tag-item');

	items.forEach(item => {
		const text = item.textContent.toLowerCase();
		const title = item.title ? item.title.toLowerCase() : '';

		if (text.includes(searchTerm) || title.includes(searchTerm)) {
			item.style.display = '';
		} else {
			item.style.display = 'none';
		}
	});
});

// Clear parent note button click handler
document.getElementById('clear-parent-note-btn').onclick = (e) => {
	e.stopPropagation();

	// Parent note'u temizle
	currentParentNoteId = null;
	updateParentNoteDisplay();

	// Otomatik kaydet (eğer bir not açıksa)
	if (currentNoteId) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after parent note clear:', error);
		});
	}
};

// Clear folder button click handler
document.getElementById('clear-folder-btn').onclick = (e) => {
	e.stopPropagation();

	// Folder'ı temizle
	currentFolderId = null;
	updateFolderDisplay();

	// Otomatik kaydet (eğer bir not açıksa)
	if (currentNoteId) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after folder clear:', error);
		});
	}
};

// Clear tag functionality - now handled by individual tag displays
// (clear-tag-btn was removed when switching to individual tag displays)

// Close parent note modal button
document.getElementById('close-parent-note-modal').onclick = () => {
	closeParentNoteModal();
};

// Close folder modal button (removed - now using + button)
// New folder button click handler
document.getElementById('new-folder-btn').onclick = () => {
	openNewFolderModal();
};

document.getElementById('new-tag-btn').onclick = () => {
	openNewTagModal();
};

// Open parent note selection modal
async function openParentNoteModal() {
	const modal = document.getElementById('parent-note-modal');
	const noteList = document.getElementById('parent-note-list');
	const searchInput = document.getElementById('parent-note-search-input');

	// Clear search
	searchInput.value = '';

	// Load notes from db.js (exclude current note, deleted and archived)
	try {
		const notes = await window.getSelectableParentNotes(currentNoteId);

		// Render list
		noteList.innerHTML = '';

		if (notes.length === 0) {
			noteList.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">Seçilebilecek not bulunamadı</div>';
		} else {
			notes.forEach(note => {
				const item = document.createElement('div');
				item.className = 'parent-note-item';
				item.textContent = note.title || 'Başlıksız Not';
				item.dataset.noteId = note.id;

				// Background color varsa ekle
				if (note.bgColor) {
					item.style.backgroundColor = note.bgColor;
				}

				item.onclick = () => {
					selectParentNote(note.id);
				};

				noteList.appendChild(item);
			});
		}

	// Show modal
	modal.classList.add('d-flex');

	// Focus search input
	setTimeout(() => searchInput.focus(), 100);

	// Close on overlay click
	modal.onclick = (e) => {
		if (e.target === modal) {
			closeParentNoteModal();
		}
	};
	} catch (error) {
		console.error('Error in openParentNoteModal:', error);
	}
}

// Close parent note modal
function closeParentNoteModal() {
	const modal = document.getElementById('parent-note-modal');
	modal.classList.remove('d-flex');
	modal.classList.add('d-none');
}

// Open folder modal
async function openFolderModal() {
	const modal = document.getElementById('folder-modal');
	const folderList = document.getElementById('folder-list');
	const searchInput = document.getElementById('folder-search-input');

	// Clear search
	searchInput.value = '';

	// Load folders from db.js
	try {
		let folders = await window.getAllFolders();

		// Sort by name
		folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

		// Render list
		folderList.innerHTML = '';

		if (folders.length === 0) {
			folderList.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">Seçilebilecek klasör bulunamadı</div>';
		} else {
			folders.forEach(folder => {
				const item = document.createElement('div');
				item.className = 'folder-item';
				item.textContent = folder.name || 'Başlıksız Klasör';
				item.dataset.folderId = folder.id;

				// Apply folder colors if they exist
				if (folder.bgColor) {
					item.style.backgroundColor = folder.bgColor;
				}
				if (folder.fontColor) {
					item.style.color = folder.fontColor;
				}

				item.onclick = () => {
					selectFolder(folder.id);
				};

				folderList.appendChild(item);
			});
		}

	// Show modal
	modal.classList.remove('d-none');
	modal.classList.add('d-flex');

	// Focus search input
	setTimeout(() => searchInput.focus(), 100);
	} catch (error) {
		console.error('Error in openFolderModal:', error);
	}
}

// Close folder modal
function closeFolderModal() {
	const modal = document.getElementById('folder-modal');
	modal.classList.remove('d-flex');
	modal.classList.add('d-none');
}

// Select a folder
function selectFolder(folderId) {
	currentFolderId = folderId;
	updateFolderDisplay();
	closeFolderModal();

	// Otomatik kaydet (eğer bir not açıksa)
	if (currentNoteId) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after folder selection:', error);
		});
	}
}

// Open new folder modal
function openNewFolderModal() {
	const modal = document.getElementById('new-folder-modal');
	const input = document.getElementById('new-folder-name-input');

	// Clear input and colors
	input.value = '';
	selectedFolderTextColor = null;
	selectedFolderBgColor = null;

	// Clear editing folder ID (important for new folder mode)
	delete modal.dataset.editingFolderId;

	// Populate color swatches
	populateFolderColor();

	// Show modal
	modal.classList.remove('d-none');
	modal.classList.add('d-flex');

	// Focus input
	setTimeout(() => input.focus(), 100);

	// Add Enter key listener
	input.onkeydown = (e) => {
		if (e.key === 'Enter') {
			saveNewFolder();
		}
	};
}

// Define text colors list (24 colors) - Dark versions for better text readability
const textColors = [
	"#0F172A", // Primary ink (çok koyu lacivert-gri)
	"#111827", // Strong blackish
	"#1F2937", // Dim gray-blue
	"#374151", // Subtle gray
	"#4B5563", // Muted gray
	"#6B7280", // Tertiary gray
	"#1E40AF", // Blue
	"#3730A3", // Indigo
	"#5B21B6", // Purple
	"#A21CAF", // Fuchsia
	"#BE185D", // Pink
	"#BE123C", // Rose
	"#B91C1C", // Red
	"#9A3412", // Orange
	"#92400E", // Amber
	"#A16207", // Yellow (dark)
	"#3F6212", // Lime green
	"#166534", // Green
	"#065F46", // Emerald
	"#155E75", // Teal / Cyan
	"#FFFFFF" // On dark
];

// Define background colors list (24 colors)
const bgColors = [
	"#FFFFFF", "#FFF8E1", "#FFF59D", "#FFE0B2", "#FFCCBC", "#F8BBD0",
	"#E1BEE7", "#D1C4E9", "#BBDEFB", "#B3E5FC", "#B2DFDB", "#C8E6C9",
	"#DCEDC8", "#E6EE9C", "#FFE082", "#FFAB91", "#ECEFF1", "#CFD8DC",
	"#D7CCC8", "#B0BEC5", "#90A4AE"
];

// Add event listeners after color definitions
document.addEventListener('DOMContentLoaded', function() {
	const resizeBtn = document.getElementById('resizeBtn');
	if (resizeBtn) {
		resizeBtn.addEventListener('click', toggleNotesPanel);
	}

	// Populate text popup colors
	populateTextPopupColors();

	// Populate background popup colors
	populateBgPopupColors();

	// Sayfa yüklendiğinde metadata container'ı gizle
	updateMetadataContainerVisibility();

	// Sidebar navigation click handlers
	const navItems = document.querySelectorAll('.nav-item');
	navItems.forEach((item) => {
		item.addEventListener('click', () => {
			const action = item.dataset.action;

			// Remove active class from all nav items
			navItems.forEach(navItem => navItem.classList.remove('active'));

			// Add active class to clicked item
			item.classList.add('active');

			// Update current sidebar view
			currentSidebarView = action;

			switch (action) {
				case 'home': // Ana Sayfa
					showAllNotes();
					break;
				case 'dark-mode': // Karanlık Mod
					toggleDarkMode();
					break;
				case 'notes': // Notlar
					showAllNotes();
					break;
				case 'favorites': // Favoriler
					showFavorites();
					break;
				case 'reminders': // Hatırlatıcılar
					showReminders();
					break;
				case 'archive': // Arşiv
					showArchived();
					break;
				case 'tags': // Etiketler
					showTags();
					break;
				case 'folders': // Klasörler
					showFolders();
					break;
				case 'trash': // Çöp Kutusu
					showTrash();
					break;
			}
			updatePermanentDeleteButtonVisibility();
		});
	});

	// Database already initialized in window.load event
	// Just load notes if needed (will be called from window.load)

	// Context menu seçeneklerine click event'leri ekle
	document.querySelectorAll('.context-item').forEach(item => {
		item.addEventListener('click', function() {
			const action = this.dataset.action;
			handleContextAction(action);
			hideContextMenu();
		});
	});

});

// Populate folder color swatches
function populateFolderColor() {
	// Create text color swatches
	const textContainer = document.getElementById('folder-text-colors');
	textContainer.innerHTML = '';
	textContainer.className = 'palette-v2'; // Add palette class for grid layout

	textColors.forEach(color => {
		const newColorBtn = document.createElement('button');
		newColorBtn.className = 'color-btn';
		newColorBtn.dataset.color = color;
		newColorBtn.style.backgroundColor = color;
		newColorBtn.onclick = () => {
			selectedFolderTextColor = color;
			updateFolderColorSelection('text');
		};
		textContainer.appendChild(newColorBtn);
	});

	// Create background color swatches
	const bgContainer = document.getElementById('folder-bg-colors');
	bgContainer.innerHTML = '';
	bgContainer.className = 'palette-v2'; // Add palette class for grid layout

	bgColors.forEach(color => {
		const newColorBtn = document.createElement('button');
		newColorBtn.className = 'color-btn';
		newColorBtn.dataset.color = color;
		newColorBtn.style.backgroundColor = color;
		newColorBtn.onclick = () => {
			selectedFolderBgColor = color;
			updateFolderColorSelection('bg');
		};
		bgContainer.appendChild(newColorBtn);
	});

	// Add clear button handlers
	document.getElementById('folder-text-clear').onclick = () => {
		selectedFolderTextColor = null;
		updateFolderColorSelection('text');
	};

	document.getElementById('folder-bg-clear').onclick = () => {
		selectedFolderBgColor = null;
		updateFolderColorSelection('bg');
	};
}

// Update folder color selection visual feedback
function updateFolderColorSelection(type) {
	const container = type === 'text' ?
		document.getElementById('folder-text-colors') :
		document.getElementById('folder-bg-colors');

	const colorBtns = container.querySelectorAll('.color-btn');
	colorBtns.forEach(colorBtn => {
		colorBtn.classList.remove('selected');
		if (type === 'text' && colorBtn.dataset.color === selectedFolderTextColor) {
			colorBtn.classList.add('selected');
		} else if (type === 'bg' && colorBtn.dataset.color === selectedFolderBgColor) {
			colorBtn.classList.add('selected');
		}
	});
}

// Close new folder modal
function closeNewFolderModal() {
	const modal = document.getElementById('new-folder-modal');
	const input = document.getElementById('new-folder-name-input');

	modal.classList.add('d-none');
	modal.classList.remove('d-flex');
	input.value = '';
	selectedFolderTextColor = null;
	selectedFolderBgColor = null;

	// Clear editing folder ID
	delete modal.dataset.editingFolderId;
}

// Save new folder
async function saveNewFolder() {
	const modal = document.getElementById('new-folder-modal');
	const editingFolderId = modal.dataset.editingFolderId;

	// If we're editing an existing folder, call updateFolder instead
	if (editingFolderId) {
		await updateFolder(editingFolderId);
		return;
	}

	const input = document.getElementById('new-folder-name-input');
	const folderName = input.value.trim();

	if (!folderName) {
		showNotification('Klasör adı boş olamaz!', 'error');
		return;
	}

	try {
		// Check for duplicate name
		const isDuplicate = await window.checkDuplicateFolder(folderName);
		if (isDuplicate) {
			showNotification('Bu isimde bir klasör zaten mevcut!', 'error');
			return;
		}

		// Create new folder
		await window.createFolder({
			name: folderName,
			bgColor: selectedFolderBgColor,
			fontColor: selectedFolderTextColor
		});

			showNotification('Klasör başarıyla oluşturuldu!', 'success');
			closeNewFolderModal();
			await updateSidebarCounts();

			if (document.getElementById('folder-modal').classList.contains('d-flex')) {
				openFolderModal();
			}

			if (currentView === 'folders') {
				await showFolders();
			}
	} catch (error) {
		console.error('Error saving folder:', error);
		showNotification('Klasör oluşturulurken hata oluştu!', 'error');
	}
}

// Get all folders
async function getAllFolders() {
	try {
		// Call db.js function
		return await window.getAllFolders();
	} catch (error) {
		console.error('Error in getAllFolders:', error);
		throw error;
	}
}

// Global variable to store original tag IDs when modal opens
let originalTagIds = [];

// Open tag modal
async function openTagModal() {
	const modal = document.getElementById('tag-modal');
	const tagList = document.getElementById('tag-list');
	const searchInput = document.getElementById('tag-search-input');

	// Store original tag IDs to detect changes
	originalTagIds = [...currentTagIds];

	// Clear search
	searchInput.value = '';

	// Load tags from db.js
	try {
		let tags = await window.getAllTags();

		// Sort by name
		tags.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

		// Render list
		tagList.innerHTML = '';

		if (tags.length === 0) {
			tagList.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">Seçilebilecek etiket bulunamadı</div>';
		} else {
			tags.forEach(tag => {
				const item = document.createElement('div');
				item.className = 'tag-item';
				item.textContent = tag.name || 'Başlıksız Etiket';
				item.dataset.tagId = tag.id;

				// Apply tag colors if they exist
				if (tag.bgColor) {
					item.style.backgroundColor = tag.bgColor;
				}
				if (tag.fontColor) {
					item.style.color = tag.fontColor;
				}

				// Check if tag is selected
				if (currentTagIds.includes(tag.id)) {
					item.classList.add('selected');
				}

				item.onclick = () => {
					toggleTagSelection(tag.id);
				};

				tagList.appendChild(item);
			});
		}

	// Show modal
	modal.classList.remove('d-none');
	modal.classList.add('d-flex');

	// Focus search input
	setTimeout(() => searchInput.focus(), 100);

	// Update selected tags display
	updateSelectedTagsDisplay();
	} catch (error) {
		console.error('Error in openTagModal:', error);
	}
}

// Toggle tag selection
function toggleTagSelection(tagId) {
	const tagItem = document.querySelector(`[data-tag-id="${tagId}"]`);

	if (currentTagIds.includes(tagId)) {
		// Remove from selection
		currentTagIds = currentTagIds.filter(id => id !== tagId);
		tagItem.classList.remove('selected');
	} else {
		// Add to selection
		currentTagIds.push(tagId);
		tagItem.classList.add('selected');
	}

	// Update selected tags display
	updateSelectedTagsDisplay();
}

// Update selected tags display in modal
async function updateSelectedTagsDisplay() {
	const container = document.getElementById('selected-tags-container');
	const list = document.getElementById('selected-tags-list');

	if (currentTagIds.length === 0) {
		container.style.display = 'none';
		return;
	}

	container.style.display = 'block';
	list.innerHTML = '';

	try {
		// Get tag details for selected tags
		for (const tagId of currentTagIds) {
			const tag = await getTagById(tagId);
			if (tag) {
				const tagElement = document.createElement('div');
				tagElement.className = 'selected-tag-item';
				tagElement.innerHTML = `
          <span>${tag.name}</span>
          <button class="remove-tag-btn" onclick="removeSelectedTag(${tagId})">
            <i class="bi bi-x"></i>
          </button>
        `;

				// Apply tag colors
				if (tag.bgColor) {
					tagElement.style.backgroundColor = tag.bgColor;
				}
				if (tag.fontColor) {
					tagElement.style.color = tag.fontColor;
				}

				list.appendChild(tagElement);
			}
		}
	} catch (error) {
		console.error('Error updating selected tags display:', error);
	}
}

// Remove tag from selection
function removeSelectedTag(tagId) {
	currentTagIds = currentTagIds.filter(id => id !== tagId);

	// Update tag item selection state
	const tagItem = document.querySelector(`[data-tag-id="${tagId}"]`);
	if (tagItem) {
		tagItem.classList.remove('selected');
	}

	// Update selected tags display
	updateSelectedTagsDisplay();
}

// Remove tag from current note
function removeTagFromNote(tagId) {
	currentTagIds = currentTagIds.filter(id => id !== tagId);
	updateTagDisplay();

	// Otomatik kaydet (eğer bir not açıksa)
	if (currentNoteId) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after tag removal:', error);
		});
	}
}

// Confirm tag selection and close modal
function confirmTagSelection() {
	updateTagDisplay();
	closeTagModal();

	// Otomatik kaydet (sadece değişiklik varsa ve bir not açıksa)
	if (currentNoteId) {
		// Check if tags changed
		const tagsChanged = 
			currentTagIds.length !== originalTagIds.length ||
			!currentTagIds.every(id => originalTagIds.includes(id)) ||
			!originalTagIds.every(id => currentTagIds.includes(id));

		if (tagsChanged) {
			saveNote().catch(error => {
				console.error('Error auto-saving note after tag selection:', error);
			});
		}
	}
}

// Close tag modal
function closeTagModal() {
	const modal = document.getElementById('tag-modal');
	modal.classList.remove('d-flex');
	modal.classList.add('d-none');
}


// Open new tag modal
function openNewTagModal() {
	const modal = document.getElementById('new-tag-modal');
	const input = document.getElementById('new-tag-name-input');

	// Clear input and colors
	input.value = '';
	selectedTagTextColor = null;
	selectedTagBgColor = null;

	// Clear editing tag ID (important for new tag mode)
	delete modal.dataset.editingTagId;

	// Populate color swatches
	populateTagColor();

	// Show modal
	modal.classList.remove('d-none');
	modal.classList.add('d-flex');

	// Focus input
	setTimeout(() => input.focus(), 100);

	// Add Enter key listener
	input.onkeydown = (e) => {
		if (e.key === 'Enter') {
			// Validate before saving
			const tagName = input.value.trim();
			if (!tagName || tagName.length === 0) {
				showNotification('Etiket adı boş olamaz!', 'error');
				input.focus();
				return;
			}
			if (tagName.length < 2) {
				showNotification('Etiket adı en az 2 karakter olmalıdır!', 'error');
				input.focus();
				return;
			}
			saveNewTag();
		}
	};
}

// Open tag modal for editing
function openTagModalForEdit(tag) {
	const modal = document.getElementById('new-tag-modal');
	const input = document.getElementById('new-tag-name-input');

	// Set input value and colors
	input.value = tag.name || '';
	selectedTagTextColor = tag.fontColor || null;
	selectedTagBgColor = tag.bgColor || null;

	// Populate color swatches
	populateTagColor();

	// Update color selection visual feedback
	updateTagColorSelection('text');
	updateTagColorSelection('bg');

	// Store the tag ID for update
	modal.dataset.editingTagId = tag.id;

	// Show modal
	modal.classList.remove('d-none');
	modal.classList.add('d-flex');

	// Focus input
	setTimeout(() => input.focus(), 100);

	// Add Enter key listener
	input.onkeydown = (e) => {
		if (e.key === 'Enter') {
			// Validate before saving
			const tagName = input.value.trim();
			if (!tagName || tagName.length === 0) {
				showNotification('Etiket adı boş olamaz!', 'error');
				input.focus();
				return;
			}
			if (tagName.length < 2) {
				showNotification('Etiket adı en az 2 karakter olmalıdır!', 'error');
				input.focus();
				return;
			}
			updateTag(tag.id);
		}
	};
}

// Update existing tag
async function updateTag(tagId) {
	const input = document.getElementById('new-tag-name-input');
	const tagName = input.value.trim();

	if (!tagName || tagName.length === 0) {
		showNotification('Etiket adı boş olamaz!', 'error');
		input.focus();
		return;
	}

	if (tagName.length < 2) {
		showNotification('Etiket adı en az 2 karakter olmalıdır!', 'error');
		input.focus();
		return;
	}

	try {
		// Check for duplicate name
		const isDuplicate = await window.checkDuplicateTag(tagName, tagId);
		if (isDuplicate) {
				showNotification('Bu isimde bir etiket zaten mevcut!', 'error');
				input.focus();
				return;
			}

			// Update tag
		await window.updateTagById(tagId, {
			name: tagName,
			fontColor: selectedTagTextColor,
			bgColor: selectedTagBgColor
		});

						showNotification('Etiket başarıyla güncellendi!', 'success');
						closeNewTagModal();
						await updateSidebarCounts();

						if (currentView === 'tags') {
							await showTags();
						}
	} catch (error) {
		console.error('Error in updateTag:', error);
						showNotification('Etiket güncellenirken hata oluştu!', 'error');
		throw error;
	}
}

// Close new tag modal
function closeNewTagModal() {
	const modal = document.getElementById('new-tag-modal');
	const input = document.getElementById('new-tag-name-input');

	modal.classList.add('d-none');
	modal.classList.remove('d-flex');
	input.value = '';
	selectedTagTextColor = null;
	selectedTagBgColor = null;

	// Clear editing tag ID
	delete modal.dataset.editingTagId;
}

// Save new tag
async function saveNewTag() {

	const modal = document.getElementById('new-tag-modal');
	const editingTagId = modal.dataset.editingTagId;

	// If we're editing an existing tag, call updateTag instead
	if (editingTagId) {
		await updateTag(editingTagId);
		return;
	}

	const input = document.getElementById('new-tag-name-input');
	const tagName = input.value.trim();

	if (!tagName || tagName.length === 0) {
		showNotification('Etiket adı boş olamaz!', 'error');
		input.focus();
		return;
	}

	if (tagName.length < 2) {
		showNotification('Etiket adı en az 2 karakter olmalıdır!', 'error');
		input.focus();
		return;
	}

	try {
	// Check for duplicate name
		const isDuplicate = await window.checkDuplicateTag(tagName);
		if (isDuplicate) {
			showNotification('Bu isimde bir etiket zaten mevcut!', 'error');
			return;
		}

		// Create new tag
		await window.createTag({
			name: tagName,
			bgColor: selectedTagBgColor,
			fontColor: selectedTagTextColor
		});

			showNotification('Etiket başarıyla oluşturuldu!', 'success');
			closeNewTagModal();
			await updateSidebarCounts();

			if (currentView === 'tags') {
				await showTags();
			} else {
				await openTagModal();
			}
	} catch (error) {
		console.error('Error in saveNewTag:', error);
			showNotification('Etiket kaydedilirken hata oluştu!', 'error');
	}
}

// Populate tag color swatches
function populateTagColor() {
	// Create text color swatches
	const textContainer = document.getElementById('tag-text-colors');
	textContainer.innerHTML = '';
	textContainer.className = 'palette-v2'; // Add palette class for grid layout

	textColors.forEach(color => {
		const newColorBtn = document.createElement('button');
		newColorBtn.className = 'color-btn';
		newColorBtn.dataset.color = color;
		newColorBtn.style.backgroundColor = color;
		newColorBtn.onclick = () => {
			selectedTagTextColor = color;
			updateTagColorSelection('text');
		};
		textContainer.appendChild(newColorBtn);
	});

	// Create background color swatches
	const bgContainer = document.getElementById('tag-bg-colors');
	bgContainer.innerHTML = '';
	bgContainer.className = 'palette-v2'; // Add palette class for grid layout

	bgColors.forEach(color => {
		const newColorBtn = document.createElement('button');
		newColorBtn.className = 'color-btn';
		newColorBtn.dataset.color = color;
		newColorBtn.style.backgroundColor = color;
		newColorBtn.onclick = () => {
			selectedTagBgColor = color;
			updateTagColorSelection('bg');
		};
		bgContainer.appendChild(newColorBtn);
	});

	// Add clear button handlers
	document.getElementById('tag-text-clear').onclick = () => {
		selectedTagTextColor = null;
		updateTagColorSelection('text');
	};

	document.getElementById('tag-bg-clear').onclick = () => {
		selectedTagBgColor = null;
		updateTagColorSelection('bg');
	};
}

// Update tag color selection visual feedback
function updateTagColorSelection(type) {
	const container = type === 'text' ?
		document.getElementById('tag-text-colors') :
		document.getElementById('tag-bg-colors');

	const colorBtns = container.querySelectorAll('.color-btn');
	colorBtns.forEach(colorBtn => {
		colorBtn.classList.remove('selected');
		if (type === 'text' && colorBtn.dataset.color === selectedTagTextColor) {
			colorBtn.classList.add('selected');
		} else if (type === 'bg' && colorBtn.dataset.color === selectedTagBgColor) {
			colorBtn.classList.add('selected');
		}
	});
}

// Get all tags
async function getAllTags() {
	try {
		// Call db.js function
		return await window.getAllTags();
	} catch (error) {
		console.error('Error in getAllTags:', error);
		throw error;
	}
}

// Get tag by ID
async function getTagById(tagId) {
	try {
		// Call db.js function
		return await window.getTagById(tagId);
	} catch (error) {
		console.error('Error in getTagById:', error);
		throw error;
	}
}

// Select a parent note
function selectParentNote(noteId) {
	currentParentNoteId = noteId;
	updateParentNoteDisplay();
	closeParentNoteModal();

	// Otomatik kaydet (eğer bir not açıksa)
	if (currentNoteId) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after parent note selection:', error);
		});
	}
}

// View toggle function
function toggleChecklistView() {
	const editor = document.getElementById('editor');
	const checklist = document.getElementById('checklist');

	if (editor.style.display === 'none') {
		editor.style.display = 'block';
		checklist.style.display = 'none';
		// Editor'a focus ver
		if (window.editor && window.editor.commands) {
			window.editor.commands.focus();
		}
	} else {
		editor.style.display = 'none';
		checklist.style.display = 'block';

		// Eğer checklist boşsa ilk item'ı oluştur
		if (checklistItems.length === 0) {
			addChecklistItem();
		}
	}
}

// Add new checklist item
function addChecklistItem(text = '') {
	const checklist = document.getElementById('checklist');
	const itemId = Date.now();

	const item = document.createElement('div');
	item.className = 'checklist-item';
	item.dataset.id = itemId;

	item.innerHTML = `
    <input type="checkbox">
    <input type="text" value="${text}" placeholder="Checklist item..." onblur="saveChecklistItemText(${itemId})">
    <div class="checklist-item-actions">
      <button class="checklist-action-btn calendar" title="Due Date" onclick="setChecklistDueDate(${itemId}, event)">
        <i class="bi bi-calendar-event"></i>
      </button>
      <button class="checklist-action-btn delete" title="Delete" onclick="removeChecklistItem(${itemId})">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;

	checklist.appendChild(item);
	checklistItems.push({
		id: itemId,
		text: text,
		completed: false,
		dueDate: null
	});

	// Focus to the input
	const input = item.querySelector('input[type="text"]');
	setTimeout(() => {
		input.focus();
		input.select();
	}, 10);

	return itemId;
}


// Remove checklist item
window.removeChecklistItem = function(itemId) {
	const itemIndex = checklistItems.findIndex(item => item.id === itemId);
	if (itemIndex !== -1) {
		checklistItems.splice(itemIndex, 1);
		const itemElement = document.querySelector(`[data-id="${itemId}"]`);
		if (itemElement) {
			itemElement.remove();
		}
	}
};

// Render checklist items from data
function renderChecklistItems() {
	const checklist = document.getElementById('checklist');
	checklist.innerHTML = ''; // Clear existing items

	checklistItems.forEach(item => {
		const itemElement = document.createElement('div');
		itemElement.className = 'checklist-item';
		if (item.completed) {
			itemElement.classList.add('completed');
		}
		itemElement.dataset.id = item.id;

		const calendarTitle = item.dueDate ? `Due Date: ${item.dueDate}` : 'Due Date';
		const calendarStyle = item.dueDate ? 'style="color: #4caf50;"' : '';

		const dueDateDisplay = item.dueDate ?
			`<span class="checklist-due-date">${new Date(item.dueDate).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</span>` : '';

		// Due date varsa has-due-date class'ını ekle
		if (item.dueDate) {
			itemElement.classList.add('has-due-date');
		}

		itemElement.innerHTML = `
      <input type="checkbox" ${item.completed ? 'checked' : ''}>
      <input type="text" value="${item.text}" placeholder="Checklist item..." onblur="saveChecklistItemText(${item.id})">
      <div class="checklist-item-actions">
        ${dueDateDisplay}
        <button class="checklist-action-btn calendar" title="${calendarTitle}" onclick="setChecklistDueDate(${item.id}, event)" ${calendarStyle}>
          <i class="bi bi-calendar-event"></i>
        </button>
        <button class="checklist-action-btn delete" title="Delete" onclick="removeChecklistItem(${item.id})">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

		checklist.appendChild(itemElement);
	});

	// Update checklist button appearance
	const checklistBtn = document.getElementById('checklistBtn');
	if (checklistBtn) {
		// Boş item'ları filtrele - sadece içi dolu olanları say
		const nonEmptyItems = checklistItems.filter(item => item.text && item.text.trim() !== '');
		
		if (nonEmptyItems.length > 0) {
			checklistBtn.classList.add('has-checklist');
		} else {
			checklistBtn.classList.remove('has-checklist');
		}
	}
}

// Save checklist item text when focus is lost
window.saveChecklistItemText = function(itemId) {
	const itemElement = document.querySelector(`[data-id="${itemId}"]`);
	if (itemElement) {
		const input = itemElement.querySelector('input[type="text"]');
		const text = input.value.trim();

		// Update the checklist item data
		const itemIndex = checklistItems.findIndex(item => item.id === itemId);
		if (itemIndex !== -1) {
			checklistItems[itemIndex].text = text;
		}
	}
};

// Set due date for checklist item
window.setChecklistDueDate = function(itemId, event) {
	event.stopPropagation();

	const itemIndex = checklistItems.findIndex(item => item.id === itemId);
	if (itemIndex !== -1) {
		currentDueDateItemId = itemId;

		// Mevcut due date'i input'lara yükle
		const currentDueDate = checklistItems[itemIndex].dueDate;
		if (currentDueDate) {
			const [date, time] = currentDueDate.split('T');
			document.getElementById('due-date-input').value = date || '';
			document.getElementById('due-time-input').value = time || '12:00';
		} else {
			// Bugünün tarihini varsayılan olarak ayarla
			const today = new Date().toISOString().split('T')[0];
			document.getElementById('due-date-input').value = today;
			document.getElementById('due-time-input').value = '12:00';
		}

		// Popup'ı aç
		const popup = document.getElementById('checklist-due-date-popup');
		const buttonRect = event.target.getBoundingClientRect();

		popup.style.top = buttonRect.bottom + window.scrollY + 5 + 'px';
		popup.style.left = buttonRect.left + window.scrollX + 'px';

		popup.classList.remove('d-none');
		popup.classList.add('d-flex');

		// Date input'a focus
		setTimeout(() => {
			document.getElementById('due-date-input').focus();
		}, 100);
	}
};

// Global variable to track current due date item
let currentDueDateItemId = null;

// Global variable to track current reminder item
let currentReminderItemId = null;

// Global variable to store current note's due date
let currentNoteDueDate = null;

// Global variable to store current note's reminder date time
let currentNoteReminderDateTime = null;

// Global variable to store current note's parent note ID
let currentParentNoteId = null;

// Global variable to store current note's folder ID
let currentFolderId = null;
let currentTagIds = [];
let selectedTagTextColor = null;
let selectedTagBgColor = null;

// Global variable to track reminder check interval
let reminderCheckInterval = null;

// Function to check for due reminders
async function checkReminders() {
	try {
		const now = new Date();
		const currentTime = now.getTime();

		// Get all notes with reminders from db.js
		const notes = await window.getNotesWithReminders();

			notes.forEach(note => {
				if (note.reminderDateTime && !note.isDeleted) {
					try {
						const reminderTime = new Date(note.reminderDateTime).getTime();

						// Check if reminder time has passed (within last 5 minutes to avoid duplicates)
						const timeDiff = currentTime - reminderTime;
						if (timeDiff >= 0 && timeDiff <= 5 * 60 * 1000) { // 5 minutes window
							showReminderNotification(note);

							// Clear the reminder after showing notification
							clearNoteReminder(note.id);

							// Refresh the note list to remove bell icon
							loadNotes();
						}
					} catch (dateError) {
						console.error('Error parsing reminder date:', dateError, note);
					}
				}
			});
	} catch (error) {
		console.error('Error in checkReminders:', error);
	}
}

// Function to clear reminder from database
async function clearNoteReminder(noteId) {
	try {
		// Call db.js function
		await window.clearNoteReminder(noteId);
	} catch (error) {
		console.error('Error in clearNoteReminder:', error);
	}
}

// Function to show reminder notification using Web Notification API
function showReminderNotification(note) {

	// Check if notifications are supported
	if (!("Notification" in window)) {
		showFallbackNotification(note);
		return;
	}

	// Check notification permission
	if (Notification.permission === "granted") {
		showWebNotification(note);
	} else if (Notification.permission !== "denied") {
		// Request permission
		Notification.requestPermission().then(permission => {
			if (permission === "granted") {
				showWebNotification(note);
			} else {
				showFallbackNotification(note);
			}
		});
	} else {
		showFallbackNotification(note);
	}
}

// Function to show web notification
function showWebNotification(note) {
	const notification = new Notification("🔔 Hatırlatıcı", {
		body: note.title,
		icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzYjgyZjYiLz4KPHRleHQgeD0iMzIiIHk9IjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iYm9sZCI+TjwvdGV4dD4KPC9zdmc+",
		tag: `reminder-${note.id}`, // Prevent duplicate notifications
		requireInteraction: true, // Keep notification until user interacts
		silent: false
	});

	// Handle notification click
	notification.onclick = function() {
		window.focus();
		openNoteFromReminder(note.id);
		notification.close();
	};

	// Auto close after 20 seconds if not interacted
	setTimeout(async () => {
		notification.close();
		// Update sidebar counts when notification auto-closes
		await updateSidebarCounts();
	}, 20000);
}

// Fallback notification for when Web Notification API is not available
function showFallbackNotification(note) {
	// Create web push style notification
	const notification = document.createElement('div');
	notification.className = 'reminder-push-notification';

	const now = new Date();
	const timeString = now.toLocaleTimeString('tr-TR', {
		hour: '2-digit',
		minute: '2-digit'
	});

	notification.innerHTML = `
    <button class="push-close" onclick="closeReminderNotification(this)">
      <i class="bi bi-x"></i>
    </button>
    
    <div class="push-header">
      <div class="push-app-info">
        <div class="push-app-icon">N</div>
        <div class="push-app-name">NoteFlix</div>
      </div>
      <div class="push-time">${timeString}</div>
    </div>
    
    <div class="push-content">
      <div class="push-title">Hatırlatıcı</div>
      <div class="push-message">${note.title}</div>
    </div>
    
    <div class="push-actions">
      <button class="push-action-btn" onclick="openNoteFromReminder(${note.id})">
        Notu Aç
      </button>
      <button class="push-action-btn primary" onclick="closeReminderNotification(this)">
        Tamam
      </button>
    </div>
  `;

	// Add to page
	document.body.appendChild(notification);

	// Play notification sound (if supported)
	try {
		const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
		audio.play().catch(() => {}); // Ignore errors if audio fails
	} catch (error) {
		// Ignore audio errors
	}
}

// Function to close reminder notification
window.closeReminderNotification = function(button) {
	const notification = button.closest('.reminder-notification, .reminder-push-notification');
	if (notification) {
		notification.remove();
	}
}

// Function to open note from reminder notification
window.openNoteFromReminder = async function(noteId) {
	// Close the notification first
	const notification = document.querySelector('.reminder-push-notification');
	if (notification) {
		notification.remove();
	}

	// Load and open the note
	await loadNote(noteId);
	
	// Update sidebar counts after opening note from reminder
	await updateSidebarCounts();
}

// Function to request notification permission
function requestNotificationPermission() {
	// Check if notifications are supported
	if (!("Notification" in window)) {
		return;
	}

	// If permission is not granted and not denied, request it
	if (Notification.permission === "default") {
		Notification.requestPermission().then(permission => {
			if (permission === "granted") {
				showNotification("Bildirim izni verildi! Hatırlatıcılar artık sistem bildirimi olarak gösterilecek.", "success");
			} else {}
		});
	} else if (Notification.permission === "granted") {} else {}
}

// Function to start reminder checking
function startReminderChecking() {
	// Clear existing interval
	if (reminderCheckInterval) {
		clearInterval(reminderCheckInterval);
	}

	// Check immediately (with delay to ensure DB is ready)
	setTimeout(() => {
		checkReminders();
	}, 1000);

	// Set interval to check every minute
	reminderCheckInterval = setInterval(checkReminders, 60 * 1000); // 60 seconds
}

// Function to stop reminder checking
function stopReminderChecking() {
	if (reminderCheckInterval) {
		clearInterval(reminderCheckInterval);
		reminderCheckInterval = null;
	}
}

// Function to update due date display
function updateDueDateDisplay(autoSave = false) {
	const dueDateDisplay = document.getElementById('due-date-display');
	const dueDateText = document.getElementById('due-date-text');
	const dueDateBtn = document.getElementById('dueDateBtn');

	if (currentNoteDueDate) {
		const date = new Date(currentNoteDueDate);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		date.setHours(0, 0, 0, 0);

		const formattedDate = date.toLocaleDateString('tr-TR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
		dueDateText.textContent = formattedDate;

		// Eğer tarih geçmişte kaldıysa kırmızı arka plan ekle
		if (date < today) {
			dueDateDisplay.classList.add('overdue');
		} else {
			dueDateDisplay.classList.remove('overdue');
		}

		dueDateDisplay.style.display = 'flex';

		// Due date button'a class ekle
		if (dueDateBtn) {
			dueDateBtn.classList.add('has-due-date');
		}
	} else {
		dueDateDisplay.style.display = 'none';

		// Due date button'dan class kaldır
		if (dueDateBtn) {
			dueDateBtn.classList.remove('has-due-date');
		}
	}

	// Container görünürlüğünü güncelle
	updateMetadataContainerVisibility();

	// Hedef tarih eklendiğinde/değiştirildiğinde notu otomatik kaydet (sadece autoSave=true ise)
	if (autoSave && currentNoteId && currentNoteDueDate) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after due date update:', error);
		});
	}
}

// Function to update reminder display
function updateReminderDisplay(autoSave = false) {
	const reminderDisplay = document.getElementById('reminder-display');
	const reminderText = document.getElementById('reminder-text');
	const reminderBtn = document.getElementById('reminderBtn');

	if (currentNoteReminderDateTime) {
		const date = new Date(currentNoteReminderDateTime);
		const now = new Date();

		const formattedDateTime = date.toLocaleString('tr-TR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
		reminderText.textContent = formattedDateTime;

		// Eğer tarih geçmişte kaldıysa kırmızı arka plan ekle
		if (date < now) {
			reminderDisplay.classList.add('overdue');
		} else {
			reminderDisplay.classList.remove('overdue');
		}

		reminderDisplay.style.display = 'flex';

		// Reminder button'a class ekle
		if (reminderBtn) {
			reminderBtn.classList.add('has-reminder');
		}
	} else {
		reminderDisplay.style.display = 'none';

		// Reminder button'dan class kaldır
		if (reminderBtn) {
			reminderBtn.classList.remove('has-reminder');
		}
	}

	updateMetadataContainerVisibility();

	// Hatırlatıcı eklendiğinde notu otomatik kaydet (sadece autoSave=true ise)
	if (autoSave && currentNoteId && currentNoteReminderDateTime) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after reminder update:', error);
		});
	}
}

// Function to update parent note display
async function updateParentNoteDisplay() {
	const parentNoteDisplay = document.getElementById('parent-note-display');
	const parentNoteText = document.getElementById('parent-note-text');
	const parentNoteBtn = document.getElementById('parent-note-btn');

	if (currentParentNoteId) {
		// Fetch parent note title from database
		try {
			const parentNote = await getNoteById(currentParentNoteId);
			if (parentNote) {
				let title = parentNote.title || 'Başlıksız Not';

				// Eğer başlık 75 karakterden uzunsa kes ve ... ekle
				if (title.length > 75) {
					title = title.substring(0, 75) + '...';
				}

				parentNoteText.textContent = title;
				parentNoteDisplay.style.display = 'flex';

				// Parent note'un background color'ını göster
				if (parentNote.bgColor) {
					parentNoteDisplay.style.backgroundColor = parentNote.bgColor;
				} else {
					parentNoteDisplay.style.backgroundColor = '';
				}

				// Parent note button'a class ekle
				if (parentNoteBtn) {
					parentNoteBtn.classList.add('has-parent-note');
				}
			} else {
				// Parent note bulunamadı, temizle
				currentParentNoteId = null;
				parentNoteDisplay.style.display = 'none';
				parentNoteDisplay.style.backgroundColor = '';

				// Parent note button'dan class kaldır
				if (parentNoteBtn) {
					parentNoteBtn.classList.remove('has-parent-note');
				}
			}
		} catch (error) {
			console.error('Error loading parent note:', error);
			parentNoteDisplay.style.display = 'none';
			parentNoteDisplay.style.backgroundColor = '';

			// Parent note button'dan class kaldır
			if (parentNoteBtn) {
				parentNoteBtn.classList.remove('has-parent-note');
			}
		}
	} else {
		parentNoteDisplay.style.display = 'none';
		parentNoteDisplay.style.backgroundColor = '';

		// Parent note button'dan class kaldır
		if (parentNoteBtn) {
			parentNoteBtn.classList.remove('has-parent-note');
		}
	}

	// Container görünürlüğünü güncelle
	updateMetadataContainerVisibility();
}

// Update folder display
async function updateFolderDisplay() {
	const folderDisplay = document.getElementById('folder-display');
	const folderText = document.getElementById('folder-text');
	const folderBtn = document.getElementById('folderPopupBtn');

	if (currentFolderId) {
		// Fetch folder name from database
		try {
			const folder = await getFolderById(currentFolderId);
			if (folder) {
				let name = folder.name || 'Başlıksız Klasör';

				// Eğer isim 75 karakterden uzunsa kes ve ... ekle
				if (name.length > 75) {
					name = name.substring(0, 75) + '...';
				}

				folderText.textContent = name;
				folderDisplay.style.display = 'flex';

				// Apply folder colors
				if (folder.bgColor) {
					folderDisplay.style.backgroundColor = folder.bgColor;
				} else {
					folderDisplay.style.backgroundColor = '';
				}

				if (folder.fontColor) {
					folderDisplay.style.color = folder.fontColor;
					folderDisplay.querySelector('i').style.color = folder.fontColor;
					folderText.style.color = folder.fontColor;
				} else {
					folderDisplay.style.color = '';
					folderDisplay.querySelector('i').style.color = '';
					folderText.style.color = '';
				}

				// Folder button'a class ekle
				if (folderBtn) {
					folderBtn.classList.add('has-folder');
				}
			} else {
				// Folder bulunamadı, temizle
				currentFolderId = null;
				folderDisplay.style.display = 'none';

				// Folder button'dan class kaldır
				if (folderBtn) {
					folderBtn.classList.remove('has-folder');
				}
			}
		} catch (error) {
			console.error('Error loading folder:', error);
			folderDisplay.style.display = 'none';

			// Folder button'dan class kaldır
			if (folderBtn) {
				folderBtn.classList.remove('has-folder');
			}
		}
	} else {
		folderDisplay.style.display = 'none';

		// Folder button'dan class kaldır
		if (folderBtn) {
			folderBtn.classList.remove('has-folder');
		}
	}

	// Container görünürlüğünü güncelle
	updateMetadataContainerVisibility();
}

// Update tag display
async function updateTagDisplay() {
	const tagContainer = document.getElementById('tag-display-container');
	const tagBtn = document.getElementById('tagPopupBtn');

	// Clear container
	tagContainer.innerHTML = '';

	if (currentTagIds.length > 0) {
		try {
			// Get all selected tags
			const tags = [];
			for (const tagId of currentTagIds) {
				const tag = await getTagById(tagId);
				if (tag) {
					tags.push(tag);
				}
			}

			if (tags.length > 0) {
				// Create individual tag displays
				tags.forEach(tag => {
					const tagDisplay = document.createElement('div');
					tagDisplay.className = 'tag-display';

					let name = tag.name || 'Başlıksız Etiket';

					// Eğer isim 75 karakterden uzunsa kes ve ... ekle
					if (name.length > 75) {
						name = name.substring(0, 75) + '...';
					}

					tagDisplay.innerHTML = `
            <i class="bi bi-tag"></i>
            <span class="tag-text">${name}</span>
            <button class="clear-tag-btn" onclick="removeTagFromNote(${tag.id})" data-tippy-content="Etiketi kaldır">
              <i class="bi bi-x"></i>
            </button>
          `;

					// Apply tag colors
					if (tag.bgColor) {
						tagDisplay.style.backgroundColor = tag.bgColor;
					}
					if (tag.fontColor) {
						tagDisplay.style.color = tag.fontColor;
						tagDisplay.querySelector('i').style.color = tag.fontColor;
						tagDisplay.querySelector('.tag-text').style.color = tag.fontColor;
					}

					tagContainer.appendChild(tagDisplay);
				});

				// Tag button'a class ekle
				if (tagBtn) {
					tagBtn.classList.add('has-tag');
				}
			} else {
				// Hiç tag bulunamadı, temizle
				currentTagIds = [];

				// Tag button'dan class kaldır
				if (tagBtn) {
					tagBtn.classList.remove('has-tag');
				}
			}
		} catch (error) {
			console.error('Error loading tags:', error);

			// Tag button'dan class kaldır
			if (tagBtn) {
				tagBtn.classList.remove('has-tag');
			}
		}
	} else {
		// Tag button'dan class kaldır
		if (tagBtn) {
			tagBtn.classList.remove('has-tag');
		}
	}

	// Container görünürlüğünü güncelle
	updateMetadataContainerVisibility();
}

// Function to update metadata container visibility
function updateMetadataContainerVisibility() {
	const container = document.getElementById('note-metadata-container');
	const dueDateDisplay = document.getElementById('due-date-display');
	const reminderDisplay = document.getElementById('reminder-display');
	const parentNoteDisplay = document.getElementById('parent-note-display');
	const folderDisplay = document.getElementById('folder-display');
	const tagDisplayContainer = document.getElementById('tag-display-container');
	const commentsCountDisplay = document.getElementById('comments-count-display');

	// Null kontrolü
	if (!container || !dueDateDisplay || !reminderDisplay || !parentNoteDisplay || !folderDisplay || !tagDisplayContainer) {
		return;
	}

	// Eğer herhangi bir metadata varsa container'ı göster
	const hasDueDate = dueDateDisplay.style.display !== 'none';
	const hasReminder = reminderDisplay.style.display !== 'none';
	const hasParentNote = parentNoteDisplay.style.display !== 'none';
	const hasFolder = folderDisplay.style.display !== 'none';
	const hasTag = tagDisplayContainer.children.length > 0;
	const hasComments = commentsCountDisplay && commentsCountDisplay.style.display !== 'none';

	if (hasDueDate || hasReminder || hasParentNote || hasFolder || hasTag || hasComments) {
		container.style.display = 'flex';
	} else {
		container.style.display = 'none';
	}
}

// Global variables moved to top of file (line 20-28)
let isDarkMode = false;

// Global variable to store note ID for single note permanent delete
let singleNoteToDelete = null;

// Global variable to store comment ID for comment delete
let commentToDelete = null;

// Global variables for folder color selection
let selectedFolderTextColor = null;
let selectedFolderBgColor = null;

// Global variable to track current sort option
let currentSortOption = 'updated'; // default: updatedAt
let currentSortDirection = 'desc'; // default: descending

// Global variable to track current sidebar view
let currentSidebarView = 'home'; // default: home

// Track sort directions for each option
let sortDirections = {
	title: 'desc',
	created: 'desc',
	updated: 'desc'
};

// Global variable to track current view state
let currentView = 'notes'; // 'notes', 'favorites', 'archive', 'reminders', 'trash'

// Function to enable/disable save button based on current view
function updateSaveButtonState() {
	const saveBtn = document.getElementById('save-note-btn');
	if (saveBtn) {
		if (currentView === 'trash') {
			saveBtn.disabled = true;
			saveBtn.title = 'Çöp kutusundaki notlar güncellenemez';
		} else {
			saveBtn.disabled = false;
			/*saveBtn.title = 'Notu kaydet';*/
		}
	}
}

// Function to show/hide permanent delete button based on current view
function updatePermanentDeleteButtonVisibility() {
	const permanentDeleteBtn = document.getElementById('permanent-delete-btn');
	if (permanentDeleteBtn) {
		if (currentView === 'trash') {
			permanentDeleteBtn.style.display = 'flex';
		} else {
			permanentDeleteBtn.style.display = 'none';
		}
	}
}

// Global variable to store notes to be deleted
let notesToDelete = [];

// Function to show permanent delete modal
async function permanentDeleteAllNotes() {
	try {
	// Get all deleted notes
		const allNotes = await window.getAllNotes();
		const deletedNotes = allNotes.filter(note => note.isDeleted === true);

	if (deletedNotes.length === 0) {
		showNotification('Çöp kutusunda silinecek not bulunamadı!', 'info');
		return;
	}

	// Store notes to delete globally
	notesToDelete = deletedNotes;

	// Update modal message
	const messageElement = document.getElementById('permanent-delete-message');
	if (messageElement) {
		messageElement.textContent = `Bu ${deletedNotes.length} notu kalıcı olarak silmek istediğinizden emin misiniz?`;
	}

	// Show modal
	showPermanentDeleteModal();
	} catch (error) {
		console.error('Error in permanentDeleteAllNotes:', error);
		showNotification('Notlar yüklenirken hata oluştu!', 'error');
	}
}

// Function to show permanent delete modal
function showPermanentDeleteModal() {
	const modal = document.getElementById('permanent-delete-modal');
	if (modal) {
		modal.classList.remove('d-none');
		modal.classList.add('d-flex');

		// Focus on cancel button for accessibility
		setTimeout(() => {
			const cancelBtn = modal.querySelector('.modal-btn-cancel');
			if (cancelBtn) {
				cancelBtn.focus();
			}
		}, 100);
	}
}

// Function to close single note permanent delete modal
function closeSingleNotePermanentDeleteModal() {
	const modal = document.getElementById('single-note-permanent-delete-modal');
	if (modal) {
		modal.classList.add('d-none');
		modal.classList.remove('d-flex');
		singleNoteToDelete = null; // Clear stored note ID
	}
}

// Function to close comment delete modal
function closeCommentDeleteModal() {
	const modal = document.getElementById('comment-delete-modal');
	if (modal) {
		modal.classList.add('d-none');
		modal.classList.remove('d-flex');
		commentToDelete = null; // Clear stored comment ID
	}
}

// Function to confirm comment delete
async function confirmCommentDelete() {
	if (!commentToDelete) {
		closeCommentDeleteModal();
		return;
	}

	const commentId = commentToDelete;

	try {
		await deleteCommentById(commentId);
		await loadComments();
		
		// Update metadata container visibility
		updateMetadataContainerVisibility();
		
		showNotification('Yorum silindi!', 'info');
		closeCommentDeleteModal();
	} catch (error) {
		console.error('Error deleting comment:', error);
		showNotification('Yorum silinirken hata oluştu!', 'error');
		closeCommentDeleteModal();
	}
}

// Function to confirm single note permanent delete
async function confirmSingleNotePermanentDelete() {
	if (!singleNoteToDelete) {
		closeSingleNotePermanentDeleteModal();
		return;
	}

	const noteId = singleNoteToDelete;

	try {
		// Not bilgisini al (başarı mesajı için)
		const note = await window.getNoteById(noteId);
		const noteTitle = note ? note.title : 'Bilinmeyen';

		// Call db.js to permanently delete the note
		await window.permanentDeleteNoteById(noteId);

			// İlgili yorumları da sil
			await deleteCommentsByNoteId(noteId);

		// UI updates
			if (currentNoteId === noteId) {
				clearEditor();
			}

			closeSingleNotePermanentDeleteModal();
			await reloadCurrentView();
			await updateSidebarCounts();
			updateNavigationButtons();

			showNotification(`"${noteTitle}" notu kalıcı olarak silindi!`, 'success');

	} catch (error) {
		console.error('Error in confirmSingleNotePermanentDelete:', error);
		showNotification('Not silinirken hata oluştu!', 'error');
		closeSingleNotePermanentDeleteModal();
	}
}

// Function to close permanent delete modal
function closePermanentDeleteModal() {
	const modal = document.getElementById('permanent-delete-modal');
	if (modal) {
		modal.classList.add('d-none');
		modal.classList.remove('d-flex');
		notesToDelete = []; // Clear stored notes
	}
}

// Function to confirm permanent delete
async function confirmPermanentDelete() {
	if (notesToDelete.length === 0) {
		closePermanentDeleteModal();
		return;
	}

	// Store the count before clearing the array
	const deletedCount = notesToDelete.length;

	try {
		// Call db.js to permanently delete all notes
		const deletePromises = notesToDelete.map(note => 
			window.permanentDeleteNoteById(note.id)
		);
		await Promise.all(deletePromises);

		// UI updates
		closePermanentDeleteModal();
		await reloadCurrentView();
		await updateSidebarCounts();

		if (currentNoteId && notesToDelete.some(note => note.id === currentNoteId)) {
			clearEditor();
		}

		updateNavigationButtons();
		showNotification(`${deletedCount} not kalıcı olarak silindi!`, 'success');

	} catch (error) {
		console.error('Error permanently deleting notes:', error);
		showNotification('Notlar silinirken hata oluştu!', 'error');
		closePermanentDeleteModal();
	}
}

// Clear editor and reset all related data
function clearEditor() {
	currentNoteId = null;
	currentNoteDueDate = null;
	currentNoteReminderDateTime = null;
	currentParentNoteId = null;
	currentFolderId = null;
	currentTagIds = [];
	updateDueDateDisplay();
	updateReminderDisplay();
	updateParentNoteDisplay();
	updateFolderDisplay();
	updateTagDisplay();
	$('note-title').value = '';

	// Editor'ü temizle (eğer yüklenmişse)
	if (window.editor && window.editor.commands) {
		window.editor.commands.clearContent();
	}

	// Checklist'i temizle
	checklistItems = [];
	const checklist = document.getElementById('checklist');
	checklist.innerHTML = '';

	$('word-count').textContent = '0 kelime';
	$('char-count').textContent = '0 karakter';

	// Editor'ü açık olarak ayarla ve checklist'i gizle
	const editorElement = document.getElementById('editor');
	editorElement.style.display = 'block';
	checklist.style.display = 'none';

	// Background color'ı temizle
	document.getElementById('editor-control').style.backgroundColor = '';
	document.getElementById('note-metadata-container').style.backgroundColor = '';

	// NoteBgColorPopupBtn butonundan class kaldır
	const noteBgColorBtn = document.getElementById('noteBgColorPopupBtn');
	if (noteBgColorBtn) {
		noteBgColorBtn.classList.remove('has-bg-color');
	}

	// Comments button'ı güncelle
	updateCommentsButton();

	// Metadata container görünürlüğünü güncelle
	updateMetadataContainerVisibility();

	// Navigation butonlarını güncelle
	updateNavigationButtons();
}

// Load view preferences from localStorage
function loadViewPreferences() {
	isCompactView = localStorage.getItem('noteflix-compact-view') === 'true';
	showChecklistCount = localStorage.getItem('noteflix-show-checklist-count') === 'true';
	showOverdueOnly = false; // Her zaman false olarak başla, localStorage'a kaydetme
	currentSortOption = localStorage.getItem('noteflix-sort-option') || 'updated';

	// Load sort directions from localStorage
	const savedSortDirections = localStorage.getItem('noteflix-sort-directions');
	if (savedSortDirections) {
		try {
			sortDirections = JSON.parse(savedSortDirections);
		} catch (error) {
			console.error('Error parsing sort directions:', error);
		}
	}
	currentSortDirection = sortDirections[currentSortOption] || 'desc';
	
	// Update list options button appearance
	updateListOptionsButton();

	// Load dark mode preference
	loadDarkModePreference();

	// Apply saved preferences
	applyViewPreferences();
}

// Save view preferences to localStorage
function saveViewPreferences() {
	localStorage.setItem('noteflix-compact-view', isCompactView.toString());
	localStorage.setItem('noteflix-show-checklist-count', showChecklistCount.toString());
	// showOverdueOnly localStorage'a kaydetme, sadece geçici olsun
}

// Apply current view preferences
function applyViewPreferences() {
	const notesContainer = document.querySelector('.notes-list');
	if (notesContainer) {
		// Apply compact view
		if (isCompactView) {
			notesContainer.classList.add('compact-view');
		} else {
			notesContainer.classList.remove('compact-view');
		}

		// Apply checklist count display
		if (showChecklistCount) {
			notesContainer.classList.add('show-checklist-count');
			updateChecklistCounts();
		} else {
			notesContainer.classList.remove('show-checklist-count');
			removeChecklistCounts();
		}
	}
}

// Toggle compact view for note list
function toggleCompactView() {
	isCompactView = !isCompactView;

	// Save to localStorage
	saveViewPreferences();

	// Apply the change
	applyViewPreferences();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Toggle checklist count display for note list
function toggleChecklistCount() {
	showChecklistCount = !showChecklistCount;

	// Save to localStorage
	saveViewPreferences();

	// Apply the change
	applyViewPreferences();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Toggle overdue notes filter
function toggleOverdue() {
	showOverdueOnly = !showOverdueOnly;

	// localStorage'a kaydetme, sadece geçici olsun

	// Reload notes with filter
	loadNotes();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Toggle has due date notes filter
function toggleHasDueDate() {
	showHasDueDateOnly = !showHasDueDateOnly;

	// localStorage'a kaydetme, sadece geçici olsun

	// Reload notes with filter
	loadNotes();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Toggle has color notes filter
function toggleHasColor() {
	showHasColorOnly = !showHasColorOnly;

	// localStorage'a kaydetme, sadece geçici olsun

	// Reload notes with filter
	loadNotes();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Toggle has reminder notes filter
function toggleHasReminder() {
	showHasReminderOnly = !showHasReminderOnly;

	// localStorage'a kaydetme, sadece geçici olsun

	// Reload notes with filter
	loadNotes();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Toggle has parent note filter
function toggleHasParentNote() {
	showHasParentNoteOnly = !showHasParentNoteOnly;

	// localStorage'a kaydetme, sadece geçici olsun

	// Reload notes with filter
	loadNotes();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Toggle has comments filter
function toggleHasComments() {
	showHasCommentsOnly = !showHasCommentsOnly;

	// localStorage'a kaydetme, sadece geçici olsun

	// Reload notes with filter
	loadNotes();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Toggle has folder info filter
function toggleHasFolderInfo() {
	showHasFolderInfoOnly = !showHasFolderInfoOnly;

	// localStorage'a kaydetme, sadece geçici olsun

	// Reload notes with filter
	loadNotes();

	// Update UI
	updateListOptionsUI();
	
	// Update list options button appearance
	updateListOptionsButton();
}

// Update list options button appearance
function updateListOptionsButton() {
	const listOptionsBtn = document.getElementById('list-options-btn');
	
	if (!listOptionsBtn) return;

	// Check if any option is active
	const hasActiveOptions = isCompactView ||
		showChecklistCount ||
		showOverdueOnly || 
		showHasDueDateOnly || 
		showHasColorOnly || 
		showHasReminderOnly || 
		showHasParentNoteOnly || 
		showHasCommentsOnly || 
		showHasFolderInfoOnly;

	if (hasActiveOptions) {
		listOptionsBtn.classList.add('has-active-options');
	} else {
		listOptionsBtn.classList.remove('has-active-options');
	}
}

// Dark mode functions
function toggleDarkMode() {
	isDarkMode = !isDarkMode;

	// Update HTML data attribute
	document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

	// Update toggle button icon and text
	updateDarkModeToggle();

	// Save to localStorage
	localStorage.setItem('noteflix-dark-mode', isDarkMode.toString());
}

function updateDarkModeToggle() {
	const toggle = document.getElementById('dark-mode-toggle');
	if (!toggle) return;

	const icon = toggle.querySelector('i');
	const text = toggle.querySelector('span');

	if (isDarkMode) {
		icon.className = 'bi bi-sun';
		text.textContent = 'Açık Mod';
	} else {
		icon.className = 'bi bi-moon';
		text.textContent = 'Karanlık Mod';
	}
}

function loadDarkModePreference() {
	const saved = localStorage.getItem('noteflix-dark-mode');
	isDarkMode = saved === 'true';

	// Apply theme
	document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

	// Update toggle button
	updateDarkModeToggle();
}

// Update list options UI to show selected items
function updateListOptionsUI() {
	document.querySelectorAll('#list-options-popup .popup-form-item').forEach(item => {
		const action = item.dataset.action;

		// Remove selected class from all
		item.classList.remove('selected');

		// Add selected class to active toggles
		if (action === 'toggle-compact' && isCompactView) {
			item.classList.add('selected');
		} else if (action === 'toggle-checklist-count' && showChecklistCount) {
			item.classList.add('selected');
		} else if (action === 'toggle-overdue' && showOverdueOnly) {
			item.classList.add('selected');
		} else if (action === 'toggle-has-due-date' && showHasDueDateOnly) {
			item.classList.add('selected');
		} else if (action === 'toggle-has-color' && showHasColorOnly) {
			item.classList.add('selected');
		} else if (action === 'toggle-has-reminder' && showHasReminderOnly) {
			item.classList.add('selected');
		} else if (action === 'toggle-has-parent-note' && showHasParentNoteOnly) {
			item.classList.add('selected');
		} else if (action === 'toggle-has-comments' && showHasCommentsOnly) {
			item.classList.add('selected');
		} else if (action === 'toggle-has-folder-info' && showHasFolderInfoOnly) {
			item.classList.add('selected');
		}
	});
}


// Update sort popup items to show current selection
function updateSortPopupItems() {
	document.querySelectorAll('#sort-options-popup .popup-form-item').forEach(item => {
		const action = item.dataset.action;
		const isCurrentOption = action === `sort-${currentSortOption}`;
		const direction = sortDirections[currentSortOption] || 'desc';

		// Remove existing arrow icon
		const existingArrow = item.querySelector('.sort-arrow');
		if (existingArrow) {
			existingArrow.remove();
		}

		if (isCurrentOption) {
			item.classList.add('selected');

			// Add arrow icon to the right
			const arrowIcon = document.createElement('i');
			arrowIcon.className = `sort-arrow ${direction === 'desc' ? 'bi-arrow-down' : 'bi-arrow-up'}`;
			item.appendChild(arrowIcon);
		} else {
			item.classList.remove('selected');
		}
	});
}

// Sort notes by different criteria
function sortNotes(sortBy) {
	// If same option is selected, toggle direction
	if (currentSortOption === sortBy) {
		sortDirections[sortBy] = sortDirections[sortBy] === 'desc' ? 'asc' : 'desc';
	} else {
		// New option selected, use its current direction
		currentSortOption = sortBy;
	}

	currentSortDirection = sortDirections[currentSortOption];

	// Save sort preferences
	localStorage.setItem('noteflix-sort-option', currentSortOption);
	localStorage.setItem('noteflix-sort-directions', JSON.stringify(sortDirections));

	// Reload notes with new sorting
	loadNotes();

}

// Update checklist counts for all notes
async function updateChecklistCounts() {
	const cards = document.querySelectorAll('.note-card');
	for (const card of cards) {
		const noteId = card.getAttribute('onclick');
		if (noteId) {
			const idMatch = noteId.match(/loadNote\((\d+)\)/);
			if (idMatch) {
				const id = parseInt(idMatch[1]);
				await addChecklistCountToCard(card, id);
			}
		}
	}
}

// Remove checklist counts from all notes
function removeChecklistCounts() {
	document.querySelectorAll('.checklist-count').forEach(count => {
		count.remove();
	});
}

// Add checklist count to a specific note card
async function addChecklistCountToCard(card, noteId) {
	// Önce mevcut count'u kaldır
	const existingCounts = card.querySelectorAll('.checklist-count');
	existingCounts.forEach(count => count.remove());

	// Eğer bu kart zaten işleniyorsa, tekrar işleme
	if (card.dataset.checklistProcessing === 'true') {
		return;
	}

	// İşleniyor flag'i ekle
	card.dataset.checklistProcessing = 'true';

	// Notu yükle ve checklist sayısını al
	try {
		const note = await window.getNoteById(noteId);
		
		if (note) {
					let checklistCount = 0;

					if (note.checklistData) {
						try {
							const checklistItems = JSON.parse(note.checklistData);
							// Sadece text'i olan ve completed olmayan item'ları say
							checklistCount = checklistItems.filter(item =>
								item.text && item.text.trim() !== '' && !item.completed
							).length;
						} catch (error) {
							console.error('Error parsing checklist data:', error);
						}
					}

					if (checklistCount > 0) {
						// Tekrar kontrol et, başka bir işlem tarafından eklenmiş olabilir
						const existingCount = card.querySelector('.checklist-count');
						if (!existingCount) {
							const countElement = document.createElement('span');
							countElement.className = 'checklist-count';
							countElement.textContent = `${checklistCount} checklist item`;

							const actionsElement = card.querySelector('.note-actions');
							if (actionsElement) {
								actionsElement.appendChild(countElement);
							}
						}
					}
				}
	} catch (error) {
		console.error('Error loading note for checklist count:', error);
			} finally {
				// İşleniyor flag'ini kaldır
				card.dataset.checklistProcessing = 'false';
	}
}

// Due date popup event handlers
document.addEventListener('DOMContentLoaded', function() {
	// Save due date button
	document.getElementById('save-due-date').onclick = function() {
		if (currentDueDateItemId) {
			const dateInput = document.getElementById('due-date-input');
			const timeInput = document.getElementById('due-time-input');

			if (dateInput.value) {
				const dueDateTime = `${dateInput.value}T${timeInput.value || '12:00'}`;

				// Update checklist item
				const itemIndex = checklistItems.findIndex(item => item.id === currentDueDateItemId);
				if (itemIndex !== -1) {
					checklistItems[itemIndex].dueDate = dueDateTime;
					updateChecklistItemDisplay(currentDueDateItemId);
				}
			}
		}

		// Close popup
		closeDueDatePopup();
	};

	// Clear due date button
	document.getElementById('clear-due-date').onclick = function() {
		if (currentDueDateItemId) {
			// Remove due date from checklist item
			const itemIndex = checklistItems.findIndex(item => item.id === currentDueDateItemId);
			if (itemIndex !== -1) {
				checklistItems[itemIndex].dueDate = null;
				updateChecklistItemDisplay(currentDueDateItemId);
			}
		}

		// Close popup
		closeDueDatePopup();
	};

	// Close popup when clicking outside
	document.addEventListener('click', function(event) {
		const popup = document.getElementById('checklist-due-date-popup');
		if (!popup.classList.contains('d-none') && !popup.contains(event.target)) {
			closeDueDatePopup();
		}
	});

	// Close modal when clicking outside
	document.addEventListener('click', function(event) {
		const modal = document.getElementById('permanent-delete-modal');
		if (modal && !modal.classList.contains('d-none') && event.target === modal) {
			closePermanentDeleteModal();
		}

		const singleNoteModal = document.getElementById('single-note-permanent-delete-modal');
		if (singleNoteModal && !singleNoteModal.classList.contains('d-none') && event.target === singleNoteModal) {
			closeSingleNotePermanentDeleteModal();
		}

		const commentDeleteModal = document.getElementById('comment-delete-modal');
		if (commentDeleteModal && !commentDeleteModal.classList.contains('d-none') && event.target === commentDeleteModal) {
			closeCommentDeleteModal();
		}

		const newFolderModal = document.getElementById('new-folder-modal');
		if (newFolderModal && !newFolderModal.classList.contains('d-none') && event.target === newFolderModal) {
			closeNewFolderModal();
		}

		const folderModal = document.getElementById('folder-modal');
		if (folderModal && !folderModal.classList.contains('d-none') && event.target === folderModal) {
			closeFolderModal();
		}

		const newTagModal = document.getElementById('new-tag-modal');
		if (newTagModal && !newTagModal.classList.contains('d-none') && event.target === newTagModal) {
			closeNewTagModal();
		}

		const tagModal = document.getElementById('tag-modal');
		if (tagModal && !tagModal.classList.contains('d-none') && event.target === tagModal) {
			closeTagModal();
		}
	});

	// Close modal with Escape key
	document.addEventListener('keydown', function(event) {
		if (event.key === 'Escape') {
			const modal = document.getElementById('permanent-delete-modal');
			if (modal && !modal.classList.contains('d-none')) {
				closePermanentDeleteModal();
			}

			const singleNoteModal = document.getElementById('single-note-permanent-delete-modal');
			if (singleNoteModal && !singleNoteModal.classList.contains('d-none')) {
				closeSingleNotePermanentDeleteModal();
			}

			const commentDeleteModal = document.getElementById('comment-delete-modal');
			if (commentDeleteModal && !commentDeleteModal.classList.contains('d-none')) {
				closeCommentDeleteModal();
			}

			const newFolderModal = document.getElementById('new-folder-modal');
			if (newFolderModal && !newFolderModal.classList.contains('d-none')) {
				closeNewFolderModal();
			}

			const folderModal = document.getElementById('folder-modal');
			if (folderModal && !folderModal.classList.contains('d-none')) {
				closeFolderModal();
			}

			const newTagModal = document.getElementById('new-tag-modal');
			if (newTagModal && !newTagModal.classList.contains('d-none')) {
				closeNewTagModal();
			}

			const tagModal = document.getElementById('tag-modal');
			if (tagModal && !tagModal.classList.contains('d-none')) {
				closeTagModal();
			}
		}

		// Navigation keyboard shortcuts
		if (event.ctrlKey && event.key === 'ArrowLeft') {
			event.preventDefault();
			navigateToPreviousNote();
		} else if (event.ctrlKey && event.key === 'ArrowRight') {
			event.preventDefault();
			navigateToNextNote();
		}
	});
});

// Close due date popup
function closeDueDatePopup() {
	const popup = document.getElementById('checklist-due-date-popup');
	popup.classList.add('d-none');
	popup.classList.remove('d-flex');
	currentDueDateItemId = null;
}

// Update checklist item display with due date
function updateChecklistItemDisplay(itemId) {
	const itemElement = document.querySelector(`[data-id="${itemId}"]`);
	if (itemElement) {
		const itemIndex = checklistItems.findIndex(item => item.id === itemId);
		if (itemIndex !== -1) {
			const item = checklistItems[itemIndex];
			const calendarBtn = itemElement.querySelector('.calendar');

			if (item.dueDate) {
				// Format date for display
				const date = new Date(item.dueDate);
				const formattedDate = date.toLocaleDateString('tr-TR', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});

				calendarBtn.style.color = '#4caf50';
				calendarBtn.title = `Due Date: ${formattedDate}`;

				// Add due date display before calendar icon
				let dueDateDisplay = itemElement.querySelector('.checklist-due-date');
				if (!dueDateDisplay) {
					dueDateDisplay = document.createElement('span');
					dueDateDisplay.className = 'checklist-due-date';
					calendarBtn.parentNode.insertBefore(dueDateDisplay, calendarBtn);
				}
				dueDateDisplay.textContent = formattedDate;

				// Add has-due-date class for always showing actions
				itemElement.classList.add('has-due-date');
			} else {
				calendarBtn.style.color = '';
				calendarBtn.title = 'Due Date';

				// Remove due date display
				const dueDateDisplay = itemElement.querySelector('.checklist-due-date');
				if (dueDateDisplay) {
					dueDateDisplay.remove();
				}

				// Remove has-due-date class
				itemElement.classList.remove('has-due-date');
			}
		}
	}
}

// noteBgColorPopupBtn click event - Now opens modal instead of popup
document.getElementById('noteBgColorPopupBtn').addEventListener('click', async function(e) {
	e.stopPropagation();
	await openNoteBgColorModal();
});

// note-bg-popup içindeki swatch'lar için event listener (eski popup için - artık kullanılmıyor)
document.querySelectorAll('#note-bg-popup .swatch').forEach(swatch => {
	swatch.addEventListener('click', function() {
		const color = this.getAttribute('data-color');
		// Not arka plan rengini değiştir
		document.getElementById('editor-control').style.backgroundColor = color;
		// Note metadata container'ın da arka plan rengini değiştir
		document.getElementById('note-metadata-container').style.backgroundColor = color;

		// NoteBgColorPopupBtn butonuna class ekle
		const noteBgColorBtn = document.getElementById('noteBgColorPopupBtn');
		if (noteBgColorBtn) {
			noteBgColorBtn.classList.add('has-bg-color');
		}

		// Popup'ı kapat
		closePopup(noteBgPopup);
	});
});

// note-bg-color-modal içindeki swatch'lar artık dinamik olarak oluşturuluyor

// note-bg-clear button için (eski popup için - artık kullanılmıyor)
document.getElementById('note-bg-clear').addEventListener('click', function() {
	document.getElementById('editor-control').style.backgroundColor = '';
	document.getElementById('note-metadata-container').style.backgroundColor = '';

	// NoteBgColorPopupBtn butonundan class kaldır
	const noteBgColorBtn = document.getElementById('noteBgColorPopupBtn');
	if (noteBgColorBtn) {
		noteBgColorBtn.classList.remove('has-bg-color');
	}

	closePopup(noteBgPopup);
});

// note-bg-modal-clear button için (yeni modal için)
document.getElementById('note-bg-modal-clear').addEventListener('click', function() {
	// Tüm swatch'ları temizle
	document.querySelectorAll('#note-bg-modal-colors .swatch').forEach(swatch => {
		swatch.classList.remove('selected');
	});

	document.getElementById('editor-control').style.backgroundColor = '';
	document.getElementById('note-metadata-container').style.backgroundColor = '';

	// NoteBgColorPopupBtn butonundan class kaldır
	const noteBgColorBtn = document.getElementById('noteBgColorPopupBtn');
	if (noteBgColorBtn) {
		noteBgColorBtn.classList.remove('has-bg-color');
	}

	// Otomatik kaydet (eğer bir not açıksa)
	if (currentNoteId) {
		saveNote().catch(error => {
			console.error('Error auto-saving note after bg color clear:', error);
		});
	}

	closeNoteBgColorModal();
});

/* ---------- Search Functionality ---------- */
// Search function
async function searchNotes(searchTerm) {
	try {
		// Get all notes from db.js
		let notes = await window.getAllNotes();

		// Arşivlenmiş ve silinmiş notları filtrele
		notes = notes.filter(note => note.isArchived !== true && note.isDeleted !== true);

		if (searchTerm.trim()) {
			// Hem title hem de content'te arama yap
			notes = notes.filter(note => {
				const title = (note.title || '').toLowerCase();
				const content = (note.content || '').toLowerCase();
				const searchLower = searchTerm.toLowerCase();

				return title.includes(searchLower) || content.includes(searchLower);
			});
		}

		// Apply sorting
		notes = applySorting(notes, currentSortOption, currentSortDirection);

		await displayNotes(notes, searchTerm);

		// Apply view preferences after notes are displayed
		setTimeout(() => {
			applyViewPreferences();
		}, 100);
	} catch (error) {
		console.error('Error in searchNotes:', error);
	}
}

// Search input event listener
const searchInput = document.querySelector('.search-input');
if (searchInput) {
	searchInput.addEventListener('input', (e) => {
		const searchTerm = e.target.value;
		searchNotes(searchTerm);
	});
}

// Clear search when clicking on search icon
const searchIcon = document.querySelector('.search-container i');
if (searchIcon) {
	searchIcon.addEventListener('click', () => {
		if (searchInput) {
			searchInput.value = '';
			searchNotes('');
		}
	});

	// Comments Modal Event Listeners
	const commentsBtn = document.getElementById('commentsBtn');
	const commentsModal = document.getElementById('comments-modal');
	const closeCommentsModal = document.getElementById('close-comments-modal');
	const addCommentBtn = document.getElementById('add-comment-btn');
	const commentTextarea = document.getElementById('comment-textarea');

	if (commentsBtn) {
		commentsBtn.addEventListener('click', openCommentsModal);
	}

	if (closeCommentsModal) {
		closeCommentsModal.addEventListener('click', closeCommentsModalFunc);
	}

	if (addCommentBtn) {
		addCommentBtn.addEventListener('click', addComment);
	}

	// Close modal when clicking outside
	if (commentsModal) {
		commentsModal.addEventListener('click', (e) => {
			if (e.target === commentsModal) {
				closeCommentsModalFunc();
			}
		});
	}

	// Close modal with Escape key
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && commentsModal && !commentsModal.style.display.includes('none')) {
			closeCommentsModalFunc();
		}
	});
}

// Comments Modal Functions
let commentsTable = null;

// Initialize comments table
function initializeCommentsTable() {
	if (!commentsTable) {
		commentsTable = {
			comments: [],
			nextId: 1
		};
	}
}

// IndexedDB Comments Functions
async function saveComment(comment) {
	try {
		// Call db.js function
		return await window.saveComment(comment);
	} catch (error) {
		console.error('Error in saveComment:', error);
		throw error;
	}
}

async function getCommentsByNoteId(noteId) {
	try {
		// Call db.js function
		return await window.getCommentsByNoteId(noteId);
	} catch (error) {
		console.error('Error in getCommentsByNoteId:', error);
		throw error;
	}
}

// Belirli bir nota ait tüm yorumları sil
async function deleteCommentsByNoteId(noteId) {
	try {
		// Call db.js function
		return await window.deleteCommentsByNoteId(noteId);
	} catch (error) {
		console.error('Error in deleteCommentsByNoteId:', error);
		throw error;
	}
}

async function deleteCommentById(commentId) {
	try {
		// Call db.js function
		await window.deleteCommentById(commentId);
		return true;
	} catch (error) {
		console.error('Error in deleteCommentById:', error);
		throw error;
	}
}

async function updateComment(comment) {
	try {
		// Call db.js function
		return await window.updateComment(comment);
	} catch (error) {
		console.error('Error in updateComment:', error);
		throw error;
	}
}

// Open comments modal
async function openCommentsModal() {
	const modal = document.getElementById('comments-modal');
	if (modal) {
		modal.style.display = 'flex';
		await loadComments();
		// Focus on textarea
		const textarea = document.getElementById('comment-textarea');
		if (textarea) {
			setTimeout(() => textarea.focus(), 100);
		}
	}
}

// Close comments modal
function closeCommentsModalFunc() {
	const modal = document.getElementById('comments-modal');
	if (modal) {
		modal.style.display = 'none';
		// Clear textarea
		const textarea = document.getElementById('comment-textarea');
		if (textarea) {
			textarea.value = '';
		}
	}
}

// Add new comment
async function addComment() {
	const currentNoteId = getCurrentNoteId();

	// Eğer currentNoteId null ise (yeni not durumunda), hata fırlat
	if (!currentNoteId) {
		showNotification('Yorum eklemek için önce bir not seçin veya yeni bir not oluşturun!', 'error');
		return;
	}

	const textarea = document.getElementById('comment-textarea');
	if (!textarea || !textarea.value.trim()) {
		showNotification('Yorum alanı boş olamaz!', 'error');
		return;
	}

	const newComment = {
		content: textarea.value.trim(),
		author: 'Kullanıcı', // Default author, can be changed later
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		noteId: currentNoteId // Use the validated note ID
	};

	try {
		await saveComment(newComment);

		// Clear textarea
		textarea.value = '';

		// Reload comments display
		await loadComments();

		// Update metadata container visibility
		updateMetadataContainerVisibility();

		// Show success notification
		showNotification('Yorum başarıyla eklendi!', 'success');
	} catch (error) {
		console.error('Error adding comment:', error);
		showNotification('Yorum eklenirken hata oluştu!', 'error');
	}
}

// Load comments from storage
async function loadComments() {
	const currentNoteId = getCurrentNoteId();

	try {
		const comments = await getCommentsByNoteId(currentNoteId);
		commentsTable = {
			comments: comments || []
		};
		displayComments();
	} catch (error) {
		console.error('Error loading comments:', error);
		commentsTable = {
			comments: []
		};
		displayComments();
	}
}

// Display comments in the modal
function displayComments() {
	const commentsList = document.getElementById('comments-list');
	const commentsCount = document.getElementById('comments-count');
	const commentsBtn = document.getElementById('commentsBtn');

	if (!commentsList) return;

	// Update count
	if (commentsCount) {
		commentsCount.textContent = commentsTable.comments.length;
	}

	// Update comments button appearance
	if (commentsBtn) {
		if (commentsTable.comments.length > 0) {
			commentsBtn.classList.add('has-comments');
		} else {
			commentsBtn.classList.remove('has-comments');
		}
	}

	// Update comments count display in metadata container
	const commentsCountDisplay = document.getElementById('comments-count-display');
	const commentsCountText = document.getElementById('comments-count-text');

	if (commentsCountDisplay && commentsCountText) {
		if (commentsTable.comments.length > 0) {
			commentsCountText.textContent = `${commentsTable.comments.length} adet Yorum`;
			commentsCountDisplay.style.display = 'flex';
		} else {
			commentsCountDisplay.style.display = 'none';
		}
	}

	// Update metadata container visibility
	updateMetadataContainerVisibility();

	// Clear existing comments
	commentsList.innerHTML = '';

	if (commentsTable.comments.length === 0) {
		// Show empty state
		commentsList.innerHTML = `
      <div class="comments-empty">
        <i class="bi bi-chat-dots"></i>
        <h4>Henüz yorum yok</h4>
        <p>Bu not için ilk yorumu siz yazın!</p>
      </div>
    `;
		return;
	}

	// Display comments (newest first)
	const sortedComments = [...commentsTable.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	sortedComments.forEach(comment => {
		const commentElement = createCommentElement(comment);
		commentsList.appendChild(commentElement);
	});
}

// Create comment element
function createCommentElement(comment) {
	const commentDiv = document.createElement('div');
	commentDiv.className = 'comment-item';

	// Format date for display
	const displayDate = new Date(comment.createdAt).toLocaleString('tr-TR');

	commentDiv.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${comment.author}</span>
      <div class="comment-date-container">
      <button class="comment-action-btn delete" onclick="deleteComment(${comment.id})" title="Yorumu Sil">
        <i class="bi bi-trash"></i>
      </button>
        <span class="comment-date">${displayDate}</span>
    </div>
    </div>
    <div class="comment-content">${comment.content}</div>
  `;
	return commentDiv;
}

// Delete comment
async function deleteComment(commentId) {
	// Store comment ID for deletion
	commentToDelete = commentId;

	// Open modal
	const modal = document.getElementById('comment-delete-modal');
	if (modal) {
		modal.classList.remove('d-none');
		modal.classList.add('d-flex');
	}
}


// Get current note ID
function getCurrentNoteId() {
	// Return the global currentNoteId variable
	return currentNoteId;
}

// Get currently displayed notes (filtered list)
async function getCurrentDisplayedNotes() {
	try {
		// Call db.js function
		return await window.getCurrentDisplayedNotes();
					} catch (error) {
		console.error('Error in getCurrentDisplayedNotes:', error);
		throw error;
	}
}

// Navigate to previous note
async function navigateToPreviousNote() {
	try {
		const notes = await getCurrentDisplayedNotes();
		if (notes.length === 0) return;

		const currentIndex = notes.findIndex(note => note.id === currentNoteId);
		if (currentIndex === -1) return; // Current note not in filtered list

		const previousIndex = currentIndex > 0 ? currentIndex - 1 : notes.length - 1;
		const previousNote = notes[previousIndex];

		if (previousNote) {
			await loadNote(previousNote.id);
		}
	} catch (error) {
		console.error('Error navigating to previous note:', error);
	}
}

// Navigate to next note
async function navigateToNextNote() {
	try {
		const notes = await getCurrentDisplayedNotes();
		if (notes.length === 0) return;

		const currentIndex = notes.findIndex(note => note.id === currentNoteId);
		if (currentIndex === -1) return; // Current note not in filtered list

		const nextIndex = currentIndex < notes.length - 1 ? currentIndex + 1 : 0;
		const nextNote = notes[nextIndex];

		if (nextNote) {
			await loadNote(nextNote.id);
		}
	} catch (error) {
		console.error('Error navigating to next note:', error);
	}
}

// Update navigation button states
async function updateNavigationButtons() {
	try {
		const notes = await getCurrentDisplayedNotes();
		const previousBtn = document.querySelector('.previous-note');
		const nextBtn = document.querySelector('.next-note');

		if (!previousBtn || !nextBtn) return;

		const currentIndex = notes.findIndex(note => note.id === currentNoteId);
		
		// Enable/disable previous button
		previousBtn.disabled = notes.length <= 1;
		
		// Enable/disable next button  
		nextBtn.disabled = notes.length <= 1;
		
	} catch (error) {
		console.error('Error updating navigation buttons:', error);
	}
}

// Get folder by ID
async function getFolderById(folderId) {
	try {
		// Call db.js function
		return await window.getFolderById(folderId);
	} catch (error) {
		console.error('Error in getFolderById:', error);
		throw error;
	}
}

// Update comments button when note changes
async function updateCommentsButton() {
	const currentNoteId = getCurrentNoteId();
	const commentsBtn = document.getElementById('commentsBtn');
	const commentsCountDisplay = document.getElementById('comments-count-display');
	const commentsCountText = document.getElementById('comments-count-text');

	if (!commentsBtn) return;

	// Eğer currentNoteId null ise (yeni not durumunda), comments button'ı temizle
	if (!currentNoteId) {
		commentsBtn.classList.remove('has-comments');
		if (commentsCountDisplay) {
			commentsCountDisplay.style.display = 'none';
		}
		// Update metadata container visibility
		updateMetadataContainerVisibility();
		return;
	}

	try {
		const comments = await getCommentsByNoteId(currentNoteId);
		
		if (comments && comments.length > 0) {
			commentsBtn.classList.add('has-comments');

			// Show comments count in metadata container
			if (commentsCountDisplay && commentsCountText) {
				commentsCountText.textContent = `${comments.length} adet Yorum`;
				commentsCountDisplay.style.display = 'flex';
			}
		} else {
			commentsBtn.classList.remove('has-comments');

			// Hide comments count from metadata container
			if (commentsCountDisplay) {
				commentsCountDisplay.style.display = 'none';
			}
		}
	} catch (error) {
		console.error('Error checking comments:', error);
		commentsBtn.classList.remove('has-comments');

		// Hide comments count from metadata container
		if (commentsCountDisplay) {
			commentsCountDisplay.style.display = 'none';
		}
	}

	// Update metadata container visibility
	updateMetadataContainerVisibility();
}

// Global functions for HTML onclick events
window.createNewNote = createNewNote;
window.openCommentsModal = openCommentsModal;
window.closeCommentsModalFunc = closeCommentsModalFunc;

/* ---------- Note Background Color Modal Functions ---------- */
// RGB formatını hex formatına çeviren yardımcı fonksiyon
function rgbToHex(rgb) {
	if (!rgb || rgb === 'transparent') return '';

	// RGB formatını parse et
	const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
	if (!match) return '';

	const r = parseInt(match[1]);
	const g = parseInt(match[2]);
	const b = parseInt(match[3]);

	// Hex formatına çevir
	const toHex = (n) => {
		const hex = n.toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};

	return '#' + toHex(r) + toHex(g) + toHex(b);
}
// Function to open note background color modal
async function openNoteBgColorModal() {
	const modal = document.getElementById('note-bg-color-modal');
	if (modal) {
		// Önce mevcut notun arka plan rengini veritabanından al
		let currentBgColor = null;

		if (currentNoteId) {
			try {
				const note = await getNoteById(currentNoteId);
				currentBgColor = note.bgColor;

				// Eğer RGB formatındaysa hex'e çevir
				if (currentBgColor && currentBgColor.startsWith('rgb(')) {
					currentBgColor = rgbToHex(currentBgColor);
				}
			} catch (error) {
				console.error('Error getting current note bg color:', error);
				// Fallback: DOM'dan al
				currentBgColor = document.getElementById('editor-control').style.backgroundColor;
				if (currentBgColor) {
					currentBgColor = rgbToHex(currentBgColor);
				}
			}
		} else {
			// Fallback: DOM'dan al
			currentBgColor = document.getElementById('editor-control').style.backgroundColor;
			if (currentBgColor) {
				currentBgColor = rgbToHex(currentBgColor);
			}
		}

		// Populate color swatches from bgColors list
		const colorContainer = document.getElementById('note-bg-modal-colors');
		colorContainer.innerHTML = '';

		bgColors.forEach(color => {
			const newColorBtn = document.createElement('button');
			newColorBtn.className = 'swatch';
			newColorBtn.dataset.color = color;
			newColorBtn.style.backgroundColor = color;

			// Eğer bu renk mevcut notun bg color'ı ise, baştan selected yap (case-insensitive)
			if (currentBgColor && color.toLowerCase() === currentBgColor.toLowerCase()) {
				newColorBtn.classList.add('selected');
			}

			newColorBtn.onclick = () => {
				// Tüm swatch'ları temizle
				document.querySelectorAll('#note-bg-modal-colors .swatch').forEach(s => {
					s.classList.remove('selected');
				});

				// Seçilen swatch'ı işaretle
				newColorBtn.classList.add('selected');

				// Not arka plan rengini değiştir
				document.getElementById('editor-control').style.backgroundColor = color;
				document.getElementById('note-metadata-container').style.backgroundColor = color;

				// NoteBgColorPopupBtn butonuna class ekle
				const noteBgColorBtn = document.getElementById('noteBgColorPopupBtn');
				if (noteBgColorBtn) {
					noteBgColorBtn.classList.add('has-bg-color');
				}

				// Otomatik kaydet (eğer bir not açıksa)
				if (currentNoteId) {
					saveNote().catch(error => {
						console.error('Error auto-saving note after bg color change:', error);
					});
				}

				// Modal'ı kapat
				closeNoteBgColorModal();
			};
			colorContainer.appendChild(newColorBtn);
		});

		modal.classList.remove('d-none');
		modal.classList.add('d-flex');
	}
}

// Function to close note background color modal
function closeNoteBgColorModal() {
	const modal = document.getElementById('note-bg-color-modal');
	if (modal) {
		modal.classList.add('d-none');
		modal.classList.remove('d-flex');
	}
}

// Make functions global
window.openNoteBgColorModal = openNoteBgColorModal;
window.closeNoteBgColorModal = closeNoteBgColorModal;

// Populate text popup colors from textColors list
function populateTextPopupColors() {
	const colorContainer = document.getElementById('text-popup-colors');
	if (!colorContainer) return;

	colorContainer.innerHTML = '';

	textColors.forEach(color => {
		const newColorBtn = document.createElement('button');
		newColorBtn.className = 'swatch';
		newColorBtn.dataset.color = color;
		newColorBtn.style.backgroundColor = color;

		newColorBtn.addEventListener('click', function() {
			// Text color uygula (TipTap editor'da seçili metne)
			editor.chain().focus().setColor(color).run();

			// Popup'ı kapat
			closePopup(textPopup);
		});

		colorContainer.appendChild(newColorBtn);
	});
}

// Populate background popup colors from bgColors list
function populateBgPopupColors() {
	const colorContainer = document.getElementById('bg-popup-colors');
	if (!colorContainer) return;

	colorContainer.innerHTML = '';

	bgColors.forEach(color => {
		const newColorBtn = document.createElement('button');
		newColorBtn.className = 'swatch';
		newColorBtn.dataset.color = color;
		newColorBtn.style.backgroundColor = color;

		newColorBtn.addEventListener('click', function() {
			// Background color uygula (TipTap editor'da seçili metne)
			editor.chain().focus().setHighlight({
				color: color
			}).run();

			// Popup'ı kapat
			closePopup(bgPopup);
		});

		colorContainer.appendChild(newColorBtn);
	});
}

// Modal dışına tıklama ile kapatma
document.getElementById('note-bg-color-modal').addEventListener('click', function(e) {
	if (e.target === this) {
		closeNoteBgColorModal();
	}
});
window.addComment = addComment;
window.deleteComment = deleteComment;
// This is just a sample script. Paste your real code (javascript or HTML) here.