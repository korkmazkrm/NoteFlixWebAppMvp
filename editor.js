/* ---------- Imports ---------- */
import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
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

/* ---------- Custom Right Blockquote Extension ---------- */
const RightBlockquote = Extension.create({
  name: 'rightBlockquote',
  addGlobalAttributes() {
    return [
      {
        types: ['blockquote'],
        attributes: {
          'data-type': {
            default: 'left',
            renderHTML: attributes => {
              if (attributes['data-type']) {
                return { 'data-type': attributes['data-type'] };
              }
              return {};
            },
            parseHTML: element => element.getAttribute('data-type') || 'left',
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setRightBlockquote: () => ({ commands }) => {
        return commands.wrapIn('blockquote', { 'data-type': 'right' });
      },
      toggleRightBlockquote: () => ({ commands }) => {
        return commands.toggleWrap('blockquote', { 'data-type': 'right' });
      },
      setLeftBlockquote: () => ({ commands }) => {
        return commands.wrapIn('blockquote', { 'data-type': 'left' });
      },
      toggleLeftBlockquote: () => ({ commands }) => {
        return commands.toggleWrap('blockquote', { 'data-type': 'left' });
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
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            renderHTML: attributes => {
              return attributes.indent > this.options.minLevel ? { "data-indent": attributes.indent } : null;
            },
            parseHTML: element => {
              const indentLevel = Number(element.getAttribute("data-indent"));
              return indentLevel && indentLevel > this.options.minLevel ? indentLevel : null;
            }
          }
        }
      }
    ];
  },
  addCommands() {
    const setNodeIndentMarkup = (tr, pos, delta) => {
      const node = tr?.doc?.nodeAt(pos);
      if (node) {
        const nextLevel = (node.attrs.indent || 0) + delta;
        const { minLevel, maxLevel } = this.options;
        const indent = nextLevel < minLevel ? minLevel : nextLevel > maxLevel ? maxLevel : nextLevel;
        if (indent !== node.attrs.indent) {
          const { indent: oldIndent, ...currentAttrs } = node.attrs;
          const nodeAttrs = indent > minLevel ? { ...currentAttrs, indent } : currentAttrs;
          return tr.setNodeMarkup(pos, node.type, nodeAttrs, node.marks);
        }
      }
      return tr;
    };
    const updateIndentLevel = (tr, delta) => {
      const { doc, selection } = tr;
      if (doc && selection) {
        const { from, to } = selection;
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
    const applyIndent = direction => () => ({ tr, state, dispatch }) => {
      const { selection } = state;
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
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
            parseHTML: element => element.style.fontSize || null,
          },
          fontFamily: {
            default: null,
            renderHTML: attrs => attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
            parseHTML: element => element.style.fontFamily || null,
          },
        },
      },
    ];
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
        editor.chain().focus().setImage({ src: imageUrl, alt: "Pasted image" }).run();
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
    TaskItem.configure({ nested: true }),
    TextStyle,
    Color, // uses TextStyle
    Highlight.configure({ multicolor: true }), // bg color
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
      if (!html && !text) { return false; }
      
      // Sadece paste event'ini yakala
      if (event.type !== 'paste') { return false; }

      event.preventDefault();

      if (html) {
        // Güvenli temizle, style'ı koru
        const clean = DOMPurify.sanitize(html, {
          ALLOWED_TAGS: ['p','b','strong','i','em','u','s','span','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','br','div'],
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

        editor.commands.insertContent(normalized, { parseOptions: { preserveWhitespace: true } });
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

function openPopup(p) { p.classList.remove('d-none'); p.classList.add('d-flex'); }
function closePopup(p) { p.classList.add('d-none'); p.classList.remove('d-flex'); }
function positionPopupAt(popup, rect, bottomLeft=null) {
	let margin = 5;
    let top = (bottomLeft == true) ? (rect.top + window.scrollY - margin) : (rect.bottom + window.scrollY + margin);
    let left = rect.left + window.scrollX;
  	popup.style.top = top + 'px';
	popup.style.left = left + 'px';
}

function closeAllPopups() {
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,noteBgPopup,commandPopup,listOptionsPopup,sortOptionsPopup].forEach(closePopup);
}

function closeAllPopupsAndModals(excludeId) {
  // Close all popups except the excluded one
  const allPopups = [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,noteBgPopup,commandPopup,listOptionsPopup,sortOptionsPopup];
  
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
  if (isOpen) { closePopup(actionsPopup); }
  else { positionPopupAt(actionsPopup, actionsBtn.getBoundingClientRect());openPopup(actionsPopup); }
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
    const { from, to } = editor.state.selection;
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
  editor.chain().focus().setYoutubeVideo({ src: embedUrl }).run();
  
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
  if (isOpen) { closePopup(imagePopup); } 
  else { $('image-file').value = '';positionPopupAt(imagePopup, imageBtn.getBoundingClientRect()); openPopup(imagePopup); }
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
    const result = editor.chain().focus().setImage({ src: imageUrl, alt: "Uploaded image" }).run();
    
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
  editor.chain().focus().setMark('textStyle', { fontSize: `${px}px` }).run();
  $('font-size-label').textContent = `${px}px`;
  currentSize = px;
}
$('font-inc').onclick = () => { currentSize += 1; applyFontSize(currentSize); };
$('font-dec').onclick = () => { if (currentSize > 8) { currentSize -= 1; applyFontSize(currentSize); } };

// Font size label'a tıklandığında 14px'e döndür
$('font-size-label').onclick = () => { 
  const defaultSize = 14; // Varsayılan font boyutu
  currentSize = defaultSize; 
  applyFontSize(currentSize); 
};

/* ---------- Font family ---------- */
$('font-family-select').onchange = (e) => {
  const family = e.target.value;
  editor.chain().focus().setMark('textStyle', { fontFamily: family }).run();
  currentFamily = family;
};

/* ---------- Selection sync (font size & family) ---------- */
editor.on('selectionUpdate', () => {
  const { from, to } = editor.state.selection;
  let foundSize = null;
  let foundFamily = null;

  editor.state.doc.nodesBetween(from, to, node => {
    if (node.type && node.type.name === 'text' && node.marks) {
      const ts = node.marks.find(m => m.type.name === 'textStyle');
      if (ts) {
        if (ts.attrs.fontSize) { foundSize = ts.attrs.fontSize; }
        if (ts.attrs.fontFamily) { foundFamily = ts.attrs.fontFamily; }
      }
    }
  });

  if (!foundSize) { foundSize = '14px'; }
  currentSize = parseInt(foundSize, 10);
  $('font-size-label').textContent = foundSize;

  if (!foundFamily) { foundFamily = 'sans-serif'; }
  currentFamily = foundFamily;
  $('font-family-select').value = foundFamily;
});

/* ---------- Heading popup ---------- */
headingBtn.onclick = (e) => {
  e.stopPropagation();
  closeAllPopupsAndModals('heading-popup');
  const isOpen = !headingPopup.classList.contains('d-none');
  if (isOpen) { closePopup(headingPopup); }
  else { positionPopupAt(headingPopup, headingBtn.getBoundingClientRect());openPopup(headingPopup); }
};

headingPopup.querySelectorAll('button').forEach(btn => {
  btn.onclick = () => {
    const level = parseInt(btn.dataset.level);
    editor.chain().focus().toggleHeading({ level }).run();
    closePopup(headingPopup);
  };
});

/* ---------- List popup ---------- */
listBtn.onclick = (e) => {
  e.stopPropagation();
  closeAllPopupsAndModals('list-popup');
  const isOpen = !listPopup.classList.contains('d-none');
  if (isOpen) { closePopup(listPopup); }
  else { positionPopupAt(listPopup, listBtn.getBoundingClientRect());openPopup(listPopup); }
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
  if (isOpen) { closePopup(alignPopup); }
  else { positionPopupAt(alignPopup, alignBtn.getBoundingClientRect());openPopup(alignPopup); }
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
  if (isOpen) { closePopup(palettePopup); }
  else { positionPopupAt(palettePopup, paletteBtn.getBoundingClientRect());openPopup(palettePopup); }
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
    editor.chain().focus().setHighlight({ color: s.dataset.color }).run();
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
  if (isOpen) { closePopup(listOptionsPopup); }
  else { 
    positionPopupAt(listOptionsPopup, listOptionsBtn.getBoundingClientRect());
    openPopup(listOptionsPopup);
    updateListOptionsUI(); // Update selected items
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
    updateSortPopupItems();
    openPopup(sortOptionsPopup); 
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
  const { from } = editor.state.selection;
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
    editor.chain().focus().deleteRange({ from: commandMenuStart, to: editor.state.selection.from }).run();
  }
  
  switch (command) {
    case 'text':
      editor.chain().focus().setParagraph().run();
      break;
    case 'h1':
      editor.chain().focus().setHeading({ level: 1 }).run();
      break;
    case 'h2':
      editor.chain().focus().setHeading({ level: 2 }).run();
      break;
    case 'h3':
      editor.chain().focus().setHeading({ level: 3 }).run();
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
editor.on('update', ({ editor }) => {
  const { from, to } = editor.state.selection;
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

/* ---------- IndexedDB Notes System ---------- */
const DB_NAME = 'NoteFlixDB';
const DB_VERSION = 138;
const STORE_NAME = 'notes';
const COMMENTS_STORE_NAME = 'comments';
let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const oldVersion = event.oldVersion;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        // Create new store
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
        store.createIndex('isArchived', 'isArchived', { unique: false });
        store.createIndex('isDeleted', 'isDeleted', { unique: false });
        store.createIndex('reminderDateTime', 'reminderDateTime', { unique: false });
      } else {
        // Migration: Add reminderDateTime index if it doesn't exist
        if (oldVersion < 137) {
          const transaction = event.target.transaction;
          const store = transaction.objectStore(STORE_NAME);
          
          // Check if reminderDateTime index exists
          if (!store.indexNames.contains('reminderDateTime')) {
            try {
              store.createIndex('reminderDateTime', 'reminderDateTime', { unique: false });
            } catch (error) {
              console.error('Error creating reminderDateTime index:', error);
            }
          }
        }
      }
      
      // Create comments object store
      if (!database.objectStoreNames.contains(COMMENTS_STORE_NAME)) {
        const commentsStore = database.createObjectStore(COMMENTS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        commentsStore.createIndex('noteId', 'noteId', { unique: false });
        commentsStore.createIndex('author', 'author', { unique: false });
        commentsStore.createIndex('createdAt', 'createdAt', { unique: false });
        commentsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

async function saveNote() {
  if (!db) await initDB();
  
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
    const existingNote = await getNoteById(currentNoteId);
    const note = {
      id: currentNoteId,
      title,
      content,
      checklistData,
      bgColor,
      dueDate: currentNoteDueDate,
      reminderDateTime: currentNoteReminderDateTime,
      parentNoteId: currentParentNoteId,
      updatedAt: now,
      isFavorite: existingNote ? existingNote.isFavorite : false,
      isArchived: existingNote ? existingNote.isArchived : false,
      isDeleted: existingNote ? existingNote.isDeleted : false
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(note);
      
      request.onsuccess = async () => {
        await reloadCurrentView(); // Refresh current view
        await updateSidebarCounts(); // Sidebar adetlerini güncelle
        
        // Başarı uyarısı göster
        showNotification('Not başarıyla güncellendi!', 'success');
        
        resolve(currentNoteId);
      };
      
      request.onerror = () => {
        console.error('Error updating note:', request.error);
        reject(request.error);
      };
    });
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
      createdAt: now,
      updatedAt: now,
      isArchived: false,
      isDeleted: false
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(note);
      
      request.onsuccess = async () => {
        await reloadCurrentView(); // Refresh current view
        await updateSidebarCounts(); // Sidebar adetlerini güncelle
        
        // Başarı uyarısı göster
        showNotification('Yeni not başarıyla oluşturuldu!', 'success');
        
        // Title ve editor'u temizle
        clearEditor();
        
        resolve(request.result);
      };
      
      request.onerror = () => {
        console.error('Error saving note:', request.error);
        reject(request.error);
      };
    });
  }
}

async function loadNotes() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      let notes = request.result;
      
      // Arşivlenmiş ve silinmiş notları filtrele
      notes = notes.filter(note => note.isArchived !== true && note.isDeleted !== true);
      
      // Hedef tarihi geçmiş notları filtrele (eğer toggle aktifse)
      if (showOverdueOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        notes = notes.filter(note => {
          if (!note.dueDate) return false; // dueDate yoksa gösterme
          
          const dueDate = new Date(note.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          
          return dueDate < today; // Sadece geçmiş tarihleri göster
        });
      }
      
      // Hedef tarihi olan notları filtrele (eğer toggle aktifse)
      if (showHasDueDateOnly) {
        notes = notes.filter(note => note.dueDate); // Sadece dueDate olan notları göster
      }
      
      // Renk atanmış notları filtrele (eğer toggle aktifse)
      if (showHasColorOnly) {
        notes = notes.filter(note => note.bgColor); // Sadece bgColor olan notları göster
      }
      
      // Apply sorting based on current sort option and direction
      switch (currentSortOption) {
        case 'title':
          notes = notes.sort((a, b) => {
            const comparison = (a.title || '').localeCompare(b.title || '');
            return currentSortDirection === 'desc' ? -comparison : comparison;
          });
          break;
        case 'created':
          notes = notes.sort((a, b) => {
            const comparison = new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt);
            return currentSortDirection === 'desc' ? comparison : -comparison;
          });
          break;
        case 'updated':
        default:
          notes = notes.sort((a, b) => {
            const comparison = new Date(b.updatedAt) - new Date(a.updatedAt);
            return currentSortDirection === 'desc' ? comparison : -comparison;
          });
          break;
      }
      
      displayNotes(notes);
      
      // Apply view preferences after notes are displayed
      setTimeout(() => {
        applyViewPreferences();
      }, 100);
      
      resolve(notes);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getNoteById(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function loadNote(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        
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
        
        // Content'i yükle ve resimleri kontrol et
        const content = note.content || '';
        
        // Checklist'i temizle ve verilerini yükle
        const checklist = document.getElementById('checklist');
        checklist.innerHTML = ''; // Önce temizle
        
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
        if (note.bgColor) {
          document.getElementById('editor-control').style.backgroundColor = note.bgColor;
          document.getElementById('note-metadata-container').style.backgroundColor = note.bgColor;
        } else {
          document.getElementById('editor-control').style.backgroundColor = '';
          document.getElementById('note-metadata-container').style.backgroundColor = '';
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
        
        // Editor'ü temizlemeden önce yeni içeriği hazırla ve tek seferde yükle
        window.editor.commands.setContent(content, false);
        
        // Focus ve sayaç güncelleme
        setTimeout(() => {
          window.editor.commands.focus();
          updateEditorCounter();
          // Update comments button appearance
          updateCommentsButton();
          resolve(note);
        }, 50);
      } else {
        reject(new Error('Note not found'));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Yeni not oluştur
function createNewNote() {
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

// Not kopyalama fonksiyonu
async function copyNote(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        const originalNote = request.result;
        const now = new Date().toISOString();
        
        // Kopyalanan not oluştur
        const copiedNote = {
          title: `(copy) ${originalNote.title}`,
          content: originalNote.content,
          checklistData: originalNote.checklistData || null,
          bgColor: originalNote.bgColor || '',
          dueDate: originalNote.dueDate || null,
          parentNoteId: originalNote.parentNoteId || null,
          createdAt: now,
          updatedAt: now
        };
        
        // Kopyalanan notu kaydet
        const writeTransaction = db.transaction([STORE_NAME], 'readwrite');
        const writeStore = writeTransaction.objectStore(STORE_NAME);
        const writeRequest = writeStore.add(copiedNote);
        
        writeRequest.onsuccess = async () => {
          await reloadCurrentView(); // Refresh current view
          await updateSidebarCounts(); // Sidebar adetlerini güncelle
          showNotification('Not başarıyla kopyalandı!', 'success');
          resolve(writeRequest.result);
        };
        
        writeRequest.onerror = () => {
          console.error('Error copying note:', writeRequest.error);
          reject(writeRequest.error);
        };
      } else {
        reject(new Error('Note not found'));
      }
    };
    
    request.onerror = () => reject(request.error);
  });
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
  return new Promise((resolve) => {
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
    
    // Ensure width is applied before resolving
    requestAnimationFrame(() => {
      resolve();
    });
    
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

async function deleteNote(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        note.isDeleted = true;
        
        const updateRequest = store.put(note);
        updateRequest.onsuccess = async () => {
          await reloadCurrentView(); // Refresh current view
          await updateSidebarCounts(); // Sidebar adetlerini güncelle
          
          // Eğer silinen not şu anda açık olan notsa, editor'ı temizle
          if (currentNoteId === id) {
            clearEditor();
          }
          
          showNotification(`${note.title} çöp kutusuna gönderildi!`, 'success');
          resolve();
        };
        
        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };
      } else {
        reject(new Error('Note not found'));
      }
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function restoreNote(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        note.isDeleted = false;
        
        const updateRequest = store.put(note);
        updateRequest.onsuccess = async () => {
          await reloadCurrentView(); // Refresh current view
          await updateSidebarCounts(); // Sidebar adetlerini güncelle
          
          showNotification(`${note.title} çöp kutusundan geri alındı!`, 'success');
          resolve();
        };
        
        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };
      } else {
        reject(new Error('Note not found'));
      }
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

function displayNotes(notes, searchTerm = '') {
  const notesList = document.querySelector('.notes-list');
  if (!notesList) return;
  
  if (notes.length === 0) {
    const message = searchTerm ? `"${searchTerm}" için sonuç bulunamadı.` : 'Listede not yer almıyor.';
    notesList.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${message}</p>`;
    return;
  }
  
  notesList.innerHTML = notes.map(note => {
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
            ${note.isFavorite ? '<i class="bi bi-star-fill favorite-star"></i>' : ''}${title}
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
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        note.isArchived = true;
        
        const updateRequest = store.put(note);
        updateRequest.onsuccess = async () => {
          await reloadCurrentView(); // Refresh current view
          await updateSidebarCounts(); // Sidebar adetlerini güncelle
          
          // Eğer arşivlenen not şu anda açık olan notsa, editor'ı temizle
          if (currentNoteId === id) {
            clearEditor();
          }
          
          showNotification(`${note.title} arşive gönderildi!`, 'success');
          resolve();
        };
        
        updateRequest.onerror = () => {
          console.error('Error archiving note:', updateRequest.error);
          reject(updateRequest.error);
        };
      } else {
        reject(new Error('Note not found'));
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Unarchive note function
async function unarchiveNote(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        note.isArchived = false;
        
        const updateRequest = store.put(note);
        updateRequest.onsuccess = async () => {
          await reloadCurrentView(); // Refresh current view
          await updateSidebarCounts(); // Sidebar adetlerini güncelle
          
          // Eğer arşivden çıkarılan not şu anda açık olan notsa, editor'ı temizle
          if (currentNoteId === id) {
            clearEditor();
          }
          
          showNotification(`${note.title} arşivden çıkarıldı!`, 'success');
          resolve();
        };
        
        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };
      } else {
        reject(new Error('Note not found'));
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Update sidebar counts
async function updateSidebarCounts() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const notes = request.result;
      
      
      // Notlar adımında: isArchived=false ve isDeleted=false olanlar
      const notesCount = notes.filter(note => note.isArchived !== true && note.isDeleted !== true).length;
      
      // Favoriler adımında: isFavorite=true, isArchived=false ve isDeleted=false olanlar
      const favoritesCount = notes.filter(note => note.isFavorite === true && note.isArchived !== true && note.isDeleted !== true).length;
      
      // Arşiv adımında: isArchived=true ve isDeleted=false olanlar
      const archiveCount = notes.filter(note => note.isArchived === true && note.isDeleted !== true).length;
      
      // Hatırlatıcılar adımında: henüz implement edilmemiş (0)
      const remindersCount = 0;
      
      // Çöp Kutusu adımında: isDeleted=true olanlar
      const trashCount = notes.filter(note => note.isDeleted === true).length;
      
      
      // HTML'deki count elementlerini güncelle
      updateCountElement('.nav-item:nth-child(3) .count', notesCount); // Notlar
      updateCountElement('.nav-item:nth-child(4) .count', favoritesCount); // Favoriler
      updateCountElement('.nav-item:nth-child(5) .count', remindersCount); // Hatırlatıcılar
      updateCountElement('.nav-item:nth-child(6) .count', archiveCount); // Arşiv
      updateCountElement('.nav-item:nth-child(7) .count', trashCount); // Çöp Kutusu
      
      resolve();
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Helper function to update count element
function updateCountElement(selector, count) {
  const countElement = document.querySelector(`.sidebar ${selector}`);
  if (countElement) {
    countElement.textContent = count;
  } else {
    console.error(`Could not find element with selector: .sidebar ${selector}`);
  }
}

// Load favorite notes only
async function loadFavoriteNotes() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      let notes = request.result;
      
      // Sadece favori olan ve arşivlenmemiş notları filtrele
      notes = notes.filter(note => note.isFavorite && !note.isArchived);
      
      // Apply sorting based on current sort option and direction
      switch (currentSortOption) {
        case 'title':
          notes = notes.sort((a, b) => {
            const comparison = (a.title || '').localeCompare(b.title || '');
            return currentSortDirection === 'desc' ? -comparison : comparison;
          });
          break;
        case 'created':
          notes = notes.sort((a, b) => {
            const comparison = new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt);
            return currentSortDirection === 'desc' ? comparison : -comparison;
          });
          break;
        case 'updated':
        default:
          notes = notes.sort((a, b) => {
            const comparison = new Date(b.updatedAt) - new Date(a.updatedAt);
            return currentSortDirection === 'desc' ? comparison : -comparison;
          });
          break;
      }
      
      displayNotes(notes);
      
      // Apply view preferences after notes are displayed
      setTimeout(() => {
        applyViewPreferences();
      }, 100);
      
      resolve(notes);
    };
    request.onerror = () => reject(request.error);
  });
}

// Load archived notes only
async function loadArchivedNotes() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      let notes = request.result;
      
      // Sadece arşivlenmiş ve silinmemiş notları filtrele
      notes = notes.filter(note => note.isArchived && note.isDeleted !== true);
      
      // Apply sorting based on current sort option and direction
      switch (currentSortOption) {
        case 'title':
          notes = notes.sort((a, b) => {
            const comparison = (a.title || '').localeCompare(b.title || '');
            return currentSortDirection === 'desc' ? -comparison : comparison;
          });
          break;
        case 'created':
          notes = notes.sort((a, b) => {
            const comparison = new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt);
            return currentSortDirection === 'desc' ? comparison : -comparison;
          });
          break;
        case 'updated':
        default:
          notes = notes.sort((a, b) => {
            const comparison = new Date(b.updatedAt) - new Date(a.updatedAt);
            return currentSortDirection === 'desc' ? comparison : -comparison;
          });
          break;
      }
      
      displayNotes(notes);
      
      // Apply view preferences after notes are displayed
      setTimeout(() => {
        applyViewPreferences();
      }, 100);
      
      resolve(notes);
    };
    request.onerror = () => reject(request.error);
  });
}

async function loadDeletedNotes() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      let notes = request.result;
      
      // Sadece silinmiş notları filtrele
      notes = notes.filter(note => note.isDeleted);
      
      // Apply sorting based on current sort option and direction
      switch (currentSortOption) {
        case 'title':
          notes = notes.sort((a, b) => {
            const comparison = (a.title || '').localeCompare(b.title || '');
            return currentSortDirection === 'desc' ? -comparison : comparison;
          });
          break;
        case 'created':
          notes = notes.sort((a, b) => {
            const comparison = new Date(a.createdAt) - new Date(b.createdAt);
            return currentSortDirection === 'desc' ? -comparison : comparison;
          });
          break;
        case 'updated':
          notes = notes.sort((a, b) => {
            const comparison = new Date(a.updatedAt) - new Date(b.updatedAt);
            return currentSortDirection === 'desc' ? -comparison : comparison;
          });
          break;
      }
      
      // Display notes
      displayNotes(notes);
      
      // Apply view preferences after a short delay to ensure DOM is ready
      setTimeout(() => {
        applyViewPreferences();
      }, 100);
      
      resolve(notes);
    };
    request.onerror = () => reject(request.error);
  });
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
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const notes = request.result;
      resolve(notes);
    };
    
    request.onerror = () => reject(request.error);
  });
}


// Reload current view based on active view state
async function reloadCurrentView() {
  
  switch(currentView) {
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
  const popups = [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,noteBgPopup,commandPopup,listOptionsPopup,sortOptionsPopup];
 
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
  if (!db) await initDB();
  
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.get(noteId);
  
  request.onsuccess = () => {
    if (request.result) {
      const note = request.result;
      note.isFavorite = !note.isFavorite;
      
      const updateRequest = store.put(note);
      updateRequest.onsuccess = async () => {
        await reloadCurrentView(); // Refresh current view
        await updateSidebarCounts(); // Sidebar adetlerini güncelle
        
        // Show notification using existing function
        if (note.isFavorite) {
          showNotification(`${note.title} favorilere eklendi!`, 'success');
        } else {
          showNotification(`${note.title} favorilerden çıkarıldı!`, 'info');
        }
      };
    }
  };
}

function updateContextMenuText(noteId) {
  // Get note data to check if it's favorite, archived, and deleted
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('Database not initialized');
      return;
    }
    
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(noteId);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        
        // Get all context menu items
        const copyItem = document.querySelector('[data-action="copy"]');
        const favoriteItem = document.querySelector('[data-action="favorite"]');
        const archiveItem = document.querySelector('[data-action="archive"]');
        const deleteItem = document.querySelector('[data-action="delete"]');
        
        if (note.isDeleted) {
          // Çöp kutusundaki notlar için sadece "Çöp Kutusundan Çıkar" göster
          if (copyItem) copyItem.style.display = 'none';
          if (favoriteItem) favoriteItem.style.display = 'none';
          if (archiveItem) archiveItem.style.display = 'none';
          if (deleteItem) {
            deleteItem.style.display = 'flex';
            const deleteSpan = deleteItem.querySelector('span');
            if (deleteSpan) {
              deleteSpan.textContent = 'Çöp Kutusundan Çıkar';
            }
          }
        } else {
          // Normal notlar için tüm seçenekleri göster
          if (copyItem) copyItem.style.display = 'flex';
          if (favoriteItem) {
            favoriteItem.style.display = 'flex';
            const favoriteSpan = favoriteItem.querySelector('span');
            if (favoriteSpan) {
              favoriteSpan.textContent = note.isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle';
            }
          }
          if (archiveItem) {
            archiveItem.style.display = 'flex';
            const archiveSpan = archiveItem.querySelector('span');
            if (archiveSpan) {
              archiveSpan.textContent = note.isArchived ? 'Arşivden Çıkar' : 'Arşive Gönder';
            }
          }
          if (deleteItem) {
            deleteItem.style.display = 'flex';
            const deleteSpan = deleteItem.querySelector('span');
            if (deleteSpan) {
              deleteSpan.textContent = 'Sil';
            }
          }
        }
        resolve();
      } else {
        reject('Note not found');
      }
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function showContextMenu(event, noteId) {
  event.preventDefault();
  
  // Store the context menu note ID for use in actions
  window.contextMenuNoteId = noteId;
  
  // Update context menu text based on note's favorite status BEFORE showing
  try {
    await updateContextMenuText(noteId);
  } catch (error) {
    console.error('Error updating context menu:', error);
  }
  
  // Now show the context menu with updated content
  const contextMenu = document.getElementById('context-menu');
  
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
}

async function handleContextAction(action) {
  if (!window.contextMenuNoteId) return;
  
  const noteId = window.contextMenuNoteId;
  
  switch(action) {
    case 'copy':
      await copyNote(noteId);
      break;
    case 'delete':
      // Check if note is deleted to determine action
      if (db) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(noteId);
        
        request.onsuccess = async () => {
          if (request.result) {
            const note = request.result;
            if (note.isDeleted) {
              await restoreNote(noteId);
            } else {
              await deleteNote(noteId);
            }
          }
          hideContextMenu();
        };
        
        request.onerror = () => {
          hideContextMenu();
        };
      }
      return; // Don't call hideContextMenu() here since it's called in the callback
    case 'favorite':
      await toggleFavorite(noteId);
      break;
    case 'archive':
      // Check if note is archived to determine action
      if (db) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(noteId);
        
        request.onsuccess = async () => {
          if (request.result) {
            const note = request.result;
            if (note.isArchived) {
              await unarchiveNote(noteId);
            } else {
              await archiveNote(noteId);
            }
          }
          hideContextMenu();
        };
        
        request.onerror = () => {
          hideContextMenu();
        };
      }
      return; // Don't call hideContextMenu() here since it's called in the callback
  }
  
  hideContextMenu();
}

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
  const resizeBtn = document.getElementById('resizeBtn');
  if (resizeBtn) {
    resizeBtn.addEventListener('click', toggleNotesPanel);
  }
  
  // Sayfa yüklendiğinde metadata container'ı gizle
  updateMetadataContainerVisibility();
  
  // Sidebar navigation click handlers
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item, index) => {
    item.addEventListener('click', async () => {
      // Dark mode toggle özel durumu
      if (item.id === 'dark-mode-toggle') {
        toggleDarkMode();
        return;
      }
      
      updateActiveNavItem(index);
      
      switch(index) {
        case 0: // Ana Sayfa - tüm notları göster
          currentView = 'notes';
          await loadNotes();
          break;
        case 1: // Dark Mode Toggle - özel durum, yukarıda handle edildi
          // Bu case'e hiç gelmez çünkü yukarıda return ediliyor
          break;
        case 2: // Notlar - arşivlenmemiş notları göster
          currentView = 'notes';
          await loadNotes();
          break;
        case 3: // Favoriler - sadece favori notları göster
          currentView = 'favorites';
          await loadFavoriteNotes();
          break;
        case 4: // Hatırlatıcılar - henüz implement edilmedi
          currentView = 'reminders';
          break;
        case 5: // Arşiv - sadece arşivlenmiş notları göster
          currentView = 'archive';
          await loadArchivedNotes();
          break;
        case 6: // Çöp Kutusu - sadece silinmiş notları göster
          currentView = 'trash';
          await loadDeletedNotes();
          break;
      }
      
      // Update save button state and permanent delete button visibility based on current view
      updateSaveButtonState();
      updatePermanentDeleteButtonVisibility();
      
      // Clear editor when switching views
      clearEditor();
    });
  });
  
  
  // Checklist event delegation'ı başlat
  initChecklistEventDelegation();
  
  // Context menu click handler
  const contextMenu = document.getElementById('context-menu');
  if (contextMenu) {
    contextMenu.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent global click handler from hiding menu
    });
  }
  
  // Context menu item clicks
  document.querySelectorAll('.context-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      await handleContextAction(action);
    });
  });
  
  // List options popup item clicks
  document.querySelectorAll('#list-options-popup .popup-form-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      if (action === 'toggle-compact') {
        toggleCompactView();
      } else if (action === 'toggle-checklist-count') {
        toggleChecklistCount();
      } else if (action === 'toggle-overdue') {
        toggleOverdue();
      } else if (action === 'toggle-has-due-date') {
        toggleHasDueDate();
      } else if (action === 'toggle-has-color') {
        toggleHasColor();
      }
      closePopup(listOptionsPopup);
    });
  });
  
  // Sort options popup item clicks
  document.querySelectorAll('#sort-options-popup .popup-form-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      if (action === 'sort-title') {
        sortNotes('title');
      } else if (action === 'sort-created') {
        sortNotes('created');
      } else if (action === 'sort-updated') {
        sortNotes('updated');
      }
      closePopup(sortOptionsPopup);
    });
  });
});

// Initialize database and load notes on page load
window.addEventListener('load', async () => {
  try {
    await initDB();
    
    // Initialize panel resizer and wait for width to be set
    await initPanelResizer();
    
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
      updateDueDateDisplay();
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
        //return;
      }
      
      // Seçilen tarihi global değişkene kaydet
      currentNoteReminderDateTime = date.toISOString();
      updateReminderDisplay();
    }
  });
  
  // Modal'ı aç
  dp.open();
};

// Clear due date button click handler
document.getElementById('clear-due-date-btn').onclick = (e) => {
  e.stopPropagation();
  
  // Tarihi temizle (veritabanına henüz kaydedilmedi, kaydet butonuna basınca güncellenecek)
  currentNoteDueDate = null;
  updateDueDateDisplay();
};

// Clear reminder button click handler
document.getElementById('clear-reminder-btn').onclick = (e) => {
  e.stopPropagation();
  
  // Hatırlatıcıyı temizle (veritabanına henüz kaydedilmedi, kaydet butonuna basınca güncellenecek)
  currentNoteReminderDateTime = null;
  updateReminderDisplay();
};

// Parent note button click handler
document.getElementById('parent-note-btn').onclick = async () => {
  await openParentNoteModal();
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

// Clear parent note button click handler
document.getElementById('clear-parent-note-btn').onclick = (e) => {
  e.stopPropagation();
  
  // Parent note'u temizle (veritabanına henüz kaydedilmedi, kaydet butonuna basınca güncellenecek)
  currentParentNoteId = null;
  updateParentNoteDisplay();
};

// Close parent note modal button
document.getElementById('close-parent-note-modal').onclick = () => {
  closeParentNoteModal();
};

// Open parent note selection modal
async function openParentNoteModal() {
  const modal = document.getElementById('parent-note-modal');
  const noteList = document.getElementById('parent-note-list');
  const searchInput = document.getElementById('parent-note-search-input');
  
  // Clear search
  searchInput.value = '';
  
  // Load notes (exclude current note, deleted and archived)
  if (!db) await initDB();
  
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();
  
  request.onsuccess = () => {
    let notes = request.result;
    
    // Filter: not deleted, not archived, not current note
    notes = notes.filter(note => 
      note.isDeleted !== true && 
      note.isArchived !== true && 
      note.id !== currentNoteId
    );
    
    // Sort by title
    notes.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    
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
        
        item.onclick = () => {
          selectParentNote(note.id);
        };
        
        noteList.appendChild(item);
      });
    }
  };
  
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
}

// Close parent note modal
function closeParentNoteModal() {
  const modal = document.getElementById('parent-note-modal');
  modal.classList.remove('d-flex');
  modal.classList.add('d-none');
}

// Select a parent note
function selectParentNote(noteId) {
  currentParentNoteId = noteId;
  updateParentNoteDisplay();
  closeParentNoteModal();
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
    if (checklistItems.length > 0) {
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

// Global variable to track reminder check interval
let reminderCheckInterval = null;

// Function to check for due reminders
async function checkReminders() {
  try {
    if (!db) {
      await initDB();
    }
    
    // Double check if db is ready
    if (!db) {
      return;
    }
    
    const now = new Date();
    const currentTime = now.getTime();
    
    // Get all notes with reminders
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    // Always use getAll() for now to avoid index issues
    const request = store.getAll();
    
    request.onsuccess = () => {
      const notes = request.result;
      
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
            }
          } catch (dateError) {
            console.error('Error parsing reminder date:', dateError, note);
          }
        }
      });
    };
    
    request.onerror = () => {
      console.error('Error checking reminders:', request.error);
    };
  } catch (error) {
    console.error('Error in checkReminders:', error);
  }
}

// Function to clear reminder from database
async function clearNoteReminder(noteId) {
  try {
    if (!db) await initDB();
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const getRequest = store.get(noteId);
    getRequest.onsuccess = () => {
      const note = getRequest.result;
      if (note) {
        note.reminderDateTime = null;
        const putRequest = store.put(note);
        putRequest.onsuccess = () => {
        };
        putRequest.onerror = () => {
          console.error('Error clearing reminder:', putRequest.error);
        };
      }
    };
    getRequest.onerror = () => {
      console.error('Error getting note for reminder clear:', getRequest.error);
    };
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

  // Auto close after 10 seconds if not interacted
  setTimeout(() => {
    notification.close();
  }, 10000);
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
window.openNoteFromReminder = function(noteId) {
  // Close the notification first
  const notification = document.querySelector('.reminder-push-notification');
  if (notification) {
    notification.remove();
  }
  
  // Load and open the note
  loadNote(noteId);
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
      } else {
      }
    });
  } else if (Notification.permission === "granted") {
  } else {
  }
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
function updateDueDateDisplay() {
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
}

// Function to update reminder display
function updateReminderDisplay() {
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
        
        // Parent note button'a class ekle
        if (parentNoteBtn) {
          parentNoteBtn.classList.add('has-parent-note');
        }
      } else {
        // Parent note bulunamadı, temizle
        currentParentNoteId = null;
        parentNoteDisplay.style.display = 'none';
        
        // Parent note button'dan class kaldır
        if (parentNoteBtn) {
          parentNoteBtn.classList.remove('has-parent-note');
        }
      }
    } catch (error) {
      console.error('Error loading parent note:', error);
      parentNoteDisplay.style.display = 'none';
      
      // Parent note button'dan class kaldır
      if (parentNoteBtn) {
        parentNoteBtn.classList.remove('has-parent-note');
      }
    }
  } else {
    parentNoteDisplay.style.display = 'none';
    
    // Parent note button'dan class kaldır
    if (parentNoteBtn) {
      parentNoteBtn.classList.remove('has-parent-note');
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
  
  // Null kontrolü
  if (!container || !dueDateDisplay || !reminderDisplay || !parentNoteDisplay) {
    return;
  }
  
  // Eğer herhangi bir metadata varsa container'ı göster
  const hasDueDate = dueDateDisplay.style.display !== 'none';
  const hasReminder = reminderDisplay.style.display !== 'none';
  const hasParentNote = parentNoteDisplay.style.display !== 'none';
  
  if (hasDueDate || hasReminder || hasParentNote) {
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
}

// Global variables to track view states (loaded from localStorage)
let isCompactView = false;
let showChecklistCount = false;
let showOverdueOnly = false;
let showHasDueDateOnly = false;
let showHasColorOnly = false;
let isDarkMode = false;

// Global variable to track current sort option
let currentSortOption = 'updated'; // default: updatedAt
let currentSortDirection = 'desc'; // default: descending

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
      saveBtn.title = 'Notu kaydet';
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
  if (!db) await initDB();
  
  // Get all deleted notes
  const deletedNotes = await new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const notes = request.result;
      const deleted = notes.filter(note => note.isDeleted === true);
      resolve(deleted);
    };
    
    request.onerror = () => reject(request.error);
  });
  
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
    // Delete all notes permanently
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const deletePromises = notesToDelete.map(note => {
      return new Promise((resolve, reject) => {
        const request = store.delete(note.id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    
    await Promise.all(deletePromises);
    
    // Close modal
    closePermanentDeleteModal();
    
    // Refresh current view and update sidebar counts
    await reloadCurrentView();
    await updateSidebarCounts();
    
    // Clear editor if current note was deleted
    if (currentNoteId && notesToDelete.some(note => note.id === currentNoteId)) {
      clearEditor();
    }
    
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
  updateDueDateDisplay();
  updateReminderDisplay();
  updateParentNoteDisplay();
  $('note-title').value = '';
  window.editor.commands.clearContent();
  
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
}

// Toggle overdue notes filter
function toggleOverdue() {
  showOverdueOnly = !showOverdueOnly;
  
  // localStorage'a kaydetme, sadece geçici olsun
  
  // Reload notes with filter
  loadNotes();
  
  // Update UI
  updateListOptionsUI();
}

// Toggle has due date notes filter
function toggleHasDueDate() {
  showHasDueDateOnly = !showHasDueDateOnly;
  
  // localStorage'a kaydetme, sadece geçici olsun
  
  // Reload notes with filter
  loadNotes();
  
  // Update UI
  updateListOptionsUI();
}

// Toggle has color notes filter
function toggleHasColor() {
  showHasColorOnly = !showHasColorOnly;
  
  // localStorage'a kaydetme, sadece geçici olsun
  
  // Reload notes with filter
  loadNotes();
  
  // Update UI
  updateListOptionsUI();
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
function updateChecklistCounts() {
  document.querySelectorAll('.note-card').forEach(card => {
    const noteId = card.getAttribute('onclick');
    if (noteId) {
      const idMatch = noteId.match(/loadNote\((\d+)\)/);
      if (idMatch) {
        const id = parseInt(idMatch[1]);
        addChecklistCountToCard(card, id);
      }
    }
  });
}

// Remove checklist counts from all notes
function removeChecklistCounts() {
  document.querySelectorAll('.checklist-count').forEach(count => {
    count.remove();
  });
}

// Add checklist count to a specific note card
function addChecklistCountToCard(card, noteId) {
  // Önce mevcut count'u kaldır
  const existingCount = card.querySelector('.checklist-count');
  if (existingCount) {
    existingCount.remove();
  }
  
  // Notu yükle ve checklist sayısını al
  if (db) {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(noteId);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        let checklistCount = 0;
        
        if (note.checklistData) {
          try {
            const checklistItems = JSON.parse(note.checklistData);
            // Sadece text'i olan item'ları say
            checklistCount = checklistItems.filter(item => item.text && item.text.trim() !== '').length;
          } catch (error) {
            console.error('Error parsing checklist data:', error);
          }
        }
        
        if (checklistCount > 0) {
          const countElement = document.createElement('span');
          countElement.className = 'checklist-count';
          countElement.textContent = `${checklistCount} checklist item`;
          
          const actionsElement = card.querySelector('.note-actions');
          if (actionsElement) {
            actionsElement.appendChild(countElement);
          }
        }
      }
    };
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
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      const modal = document.getElementById('permanent-delete-modal');
      if (modal && !modal.classList.contains('d-none')) {
        closePermanentDeleteModal();
      }
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

// noteBgColorPopupBtn click event
document.getElementById('noteBgColorPopupBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  
  // note-bg-popup'ın açık olup olmadığını kontrol et (closeAllPopups'tan önce)
  const popup = document.getElementById('note-bg-popup');
  const isOpen = !popup.classList.contains('d-none');
  
  if (isOpen) { 
    // Popup açıksa, sadece onu kapat
    closePopup(popup);
  } else { 
    // Popup kapalıysa, diğer popup'ları kapat ve bu popup'ı aç
    closeAllPopups();
    const buttonRect = this.getBoundingClientRect();
    // Popup pozisyonunu ayarla (butonun üstünde)
    positionPopupAt(popup, buttonRect, true);
    openPopup(popup);
  }
});

// note-bg-popup içindeki swatch'lar için event listener
document.querySelectorAll('#note-bg-popup .swatch').forEach(swatch => {
  swatch.addEventListener('click', function() {
    const color = this.getAttribute('data-color');
    // Not arka plan rengini değiştir
    document.getElementById('editor-control').style.backgroundColor = color;
    // Note metadata container'ın da arka plan rengini değiştir
    document.getElementById('note-metadata-container').style.backgroundColor = color;
    // Popup'ı kapat
    closePopup(noteBgPopup);
  });
});

// note-bg-clear button için
document.getElementById('note-bg-clear').addEventListener('click', function() {
  document.getElementById('editor-control').style.backgroundColor = '';
  document.getElementById('note-metadata-container').style.backgroundColor = '';
  closePopup(noteBgPopup);
});

/* ---------- Search Functionality ---------- */
// Search function
function searchNotes(searchTerm) {
  if (!db) return;
  
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();
  
  request.onsuccess = () => {
    let notes = request.result;
    
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
    
    // Apply sorting based on current sort option and direction
    switch (currentSortOption) {
      case 'title':
        notes = notes.sort((a, b) => {
          const comparison = (a.title || '').localeCompare(b.title || '');
          return currentSortDirection === 'desc' ? -comparison : comparison;
        });
        break;
      case 'created':
        notes = notes.sort((a, b) => {
          const comparison = new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt);
          return currentSortDirection === 'desc' ? comparison : -comparison;
        });
        break;
      case 'updated':
      default:
        notes = notes.sort((a, b) => {
          const comparison = new Date(b.updatedAt) - new Date(a.updatedAt);
          return currentSortDirection === 'desc' ? comparison : -comparison;
        });
        break;
    }
    
    displayNotes(notes, searchTerm);
    
    // Apply view preferences after notes are displayed
    setTimeout(() => {
      applyViewPreferences();
    }, 100);
  };
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
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([COMMENTS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(COMMENTS_STORE_NAME);
    
    const request = store.add(comment);
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function getCommentsByNoteId(noteId) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([COMMENTS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(COMMENTS_STORE_NAME);
    const index = store.index('noteId');
    
    const request = index.getAll(noteId);
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function deleteCommentById(commentId) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([COMMENTS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(COMMENTS_STORE_NAME);
    
    const request = store.delete(commentId);
    
    request.onsuccess = () => {
      resolve(true);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function updateComment(comment) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([COMMENTS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(COMMENTS_STORE_NAME);
    
    const request = store.put(comment);
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
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
  const textarea = document.getElementById('comment-textarea');
  if (!textarea || !textarea.value.trim()) {
    return;
  }

  const newComment = {
    content: textarea.value.trim(),
    author: 'Kullanıcı', // Default author, can be changed later
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    noteId: getCurrentNoteId() // Get current note ID
  };

  try {
    await saveComment(newComment);
    
    // Clear textarea
    textarea.value = '';
    
    // Reload comments display
    await loadComments();
    
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
    commentsTable = { comments: comments || [] };
    displayComments();
  } catch (error) {
    console.error('Error loading comments:', error);
    commentsTable = { comments: [] };
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
      <span class="comment-date">${displayDate}</span>
    </div>
    <div class="comment-content">${comment.content}</div>
    <div class="comment-actions">
      <button class="comment-action-btn delete" onclick="deleteComment(${comment.id})" title="Yorumu Sil">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;
  return commentDiv;
}

// Delete comment
async function deleteComment(commentId) {
  if (confirm('Bu yorumu silmek istediğinizden emin misiniz?')) {
    try {
      await deleteCommentById(commentId);
      await loadComments();
      showNotification('Yorum silindi!', 'info');
    } catch (error) {
      console.error('Error deleting comment:', error);
      showNotification('Yorum silinirken hata oluştu!', 'error');
    }
  }
}


// Get current note ID
function getCurrentNoteId() {
  // Try to get from current note data
  if (window.currentNote && window.currentNote.id) {
    return window.currentNote.id;
  }
  
  // Fallback to a default ID or generate one
  return 'default-note';
}

// Update comments button when note changes
async function updateCommentsButton() {
  const currentNoteId = getCurrentNoteId();
  const commentsBtn = document.getElementById('commentsBtn');
  const commentsCountDisplay = document.getElementById('comments-count-display');
  const commentsCountText = document.getElementById('comments-count-text');
  
  if (!commentsBtn) return;
  
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
window.addComment = addComment;
window.deleteComment = deleteComment;
