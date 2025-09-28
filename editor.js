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

let commandPopup = $('command-popup');
let commandFilter = $('command-filter');

let listOptionsBtn = $('list-options-btn');
let listOptionsPopup = $('list-options-popup');

let sortBtn = $('sort-btn');
let sortOptionsPopup = $('sort-options-popup');

const parentNoteBtn = $('parent-note-btn');
let parentNotePopup = $('parent-note-popup');

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
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,sortOptionsPopup,parentNotePopup].forEach(closePopup);
}

/* ---------- Toolbar actions ---------- */
$('bold-btn').onclick = () => { editor.chain().focus().toggleBold().run(); };
$('italic-btn').onclick = () => { editor.chain().focus().toggleItalic().run(); };
$('underline-btn').onclick = () => { editor.chain().focus().toggleUnderline().run(); };
$('strike-btn').onclick = () => { editor.chain().focus().toggleStrike().run(); };

/* ---------- Actions popup ---------- */
$('actions-btn').onclick = (e) => {
  e.stopPropagation();
  [headingPopup,listPopup,alignPopup,palettePopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
    // Block formatting
    .setParagraph()
    .setTextAlign('left')
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
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
    console.log('Image added to editor:', imageUrl.substring(0, 100) + '...'); // Debug için
    console.log('Full image URL length:', imageUrl.length);
    
    // Resmi editor'a ekle
    const result = editor.chain().focus().setImage({ src: imageUrl, alt: "Uploaded image" }).run();
    console.log('Image insertion result:', result);
    
    // Editor içeriğini kontrol et
    setTimeout(() => {
      const editorContent = editor.getHTML();
      console.log('Editor content after image insertion:', editorContent);
    }, 100);
    
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
  [listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
  [headingPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
  [headingPopup,listPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
  [headingPopup,listPopup,alignPopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,sortOptionsPopup,parentNotePopup].forEach(closePopup);
  const isOpen = !listOptionsPopup.classList.contains('d-none');console.log('listOptionsBtn:' + isOpen);
  if (isOpen) { closePopup(listOptionsPopup); }
  else { positionPopupAt(listOptionsPopup, listOptionsBtn.getBoundingClientRect());openPopup(listOptionsPopup); }
};

// Sort button click handler
sortBtn.onclick = (e) => {
  e.stopPropagation();
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup].forEach(closePopup);
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
parentNoteBtn.onclick = (e) => {
  e.stopPropagation();
  closeAllPopups();
  let bottomLeft=true;
  const isOpen = !parentNotePopup.classList.contains('d-none');
  if (isOpen) { closePopup(parentNotePopup); }
  else { positionPopupAt(parentNotePopup, parentNoteBtn.getBoundingClientRect(), bottomLeft);openPopup(parentNotePopup); }
};


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
const DB_VERSION = 131;
const STORE_NAME = 'notes';
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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
      }
    };
  });
}

async function saveNote() {
  if (!db) await initDB();
  
  const title = $('note-title').value.trim();
  const content = editor.getHTML();
  const now = new Date().toISOString();
  
  // Checklist verilerini al
  const checklistData = JSON.stringify(checklistItems);
  
  // Başlık zorunlu kontrolü
  if (!title) {
    showNotification('Lütfen not başlığı giriniz!', 'info');
    $('note-title').focus();
    return;
  }
  
  console.log('Saving note with content:', content);
  console.log('Content length:', content.length);
  console.log('Checklist data:', checklistData);
  console.log('Contains img tags:', content.includes('<img'));
  console.log('Contains base64:', content.includes('data:image'));
  console.log('Current note ID:', currentNoteId);
  
  // Eğer mevcut bir not seçiliyse güncelle, değilse yeni oluştur
  if (currentNoteId) {
    // Mevcut notu güncelle
    const note = {
      id: currentNoteId,
      title,
      content,
      checklistData,
      updatedAt: now
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(note);
      
      request.onsuccess = () => {
        console.log('Note updated with ID:', currentNoteId);
        loadNotes();
        
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
      createdAt: now,
      updatedAt: now
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(note);
      
      request.onsuccess = () => {
        console.log('New note saved with ID:', request.result);
        loadNotes();
        
        // Başarı uyarısı göster
        showNotification('Yeni not başarıyla oluşturuldu!', 'success');
        
        // Title ve editor'u temizle
        $('note-title').value = '';
        window.editor.commands.clearContent();
        $('word-count').textContent = '0 kelime';
        $('char-count').textContent = '0 karakter';
        
        // Yeni not için currentNoteId'yi sıfırla
        currentNoteId = null;
        
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

async function loadNote(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        console.log('Loading note with content:', note.content);
        
        // Mevcut not ID'sini ayarla
        currentNoteId = id;
        console.log('Current note ID set to:', currentNoteId);
        
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
        console.log('Setting content to editor:', content);
        console.log('Content length:', content.length);
        console.log('Content type:', typeof content);
        
        // Checklist'i temizle ve verilerini yükle
        const checklist = document.getElementById('checklist');
        checklist.innerHTML = ''; // Önce temizle
        
        if (note.checklistData) {
          try {
            checklistItems = JSON.parse(note.checklistData);
            console.log('Loaded checklist items:', checklistItems);
            renderChecklistItems();
          } catch (error) {
            console.error('Error parsing checklist data:', error);
            checklistItems = [];
          }
        } else {
          checklistItems = [];
        }
        
        // Editor'ü açık olarak ayarla ve checklist'i gizle
        const editorElement = document.getElementById('editor');
        editorElement.style.display = 'block';
        checklist.style.display = 'none';
        
        // Editor'ü temizle ve yeni içeriği yükle
        window.editor.commands.clearContent();
        
        // Content set etme işlemini gecikme ile yap
        setTimeout(() => {
          console.log('Setting content after delay:', content);
          window.editor.commands.setContent(content, false);
          
          // Focus ve sayaç güncelleme
          setTimeout(() => {
            window.editor.commands.focus();
            updateEditorCounter();
            console.log('Content loaded and focused');
            resolve(note);
          }, 50);
        }, 100);
      } else {
        reject(new Error('Note not found'));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Yeni not oluştur
function createNewNote() {
  currentNoteId = null;
  $('note-title').value = '';
  window.editor.commands.clearContent();
  
  // Checklist'i temizle
  checklistItems = [];
  const checklist = document.getElementById('checklist');
  checklist.innerHTML = '';
  
  // Tüm seçili not'ların class'ını kaldır
  document.querySelectorAll('.note-card.selected').forEach(card => {
    card.classList.remove('selected');
  });
  
  $('word-count').textContent = '0 kelime';
  $('char-count').textContent = '0 karakter';
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
      <i class="bi bi-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
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
          createdAt: now,
          updatedAt: now
        };
        
        // Kopyalanan notu kaydet
        const writeTransaction = db.transaction([STORE_NAME], 'readwrite');
        const writeStore = writeTransaction.objectStore(STORE_NAME);
        const writeRequest = writeStore.add(copiedNote);
        
        writeRequest.onsuccess = () => {
          console.log('Note copied with ID:', writeRequest.result);
          loadNotes();
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

async function deleteNote(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      loadNotes();
      
      // Eğer silinen not şu anda açık olan notsa, editor'ı temizle
      if (currentNoteId === id) {
        currentNoteId = null;
        $('note-title').value = '';
        window.editor.commands.clearContent();
        
        // Checklist'i temizle
        checklistItems = [];
        const checklist = document.getElementById('checklist');
        checklist.innerHTML = '';
        
        $('word-count').textContent = '0 kelime';
        $('char-count').textContent = '0 karakter';
      }
      
      // Başarı uyarısı göster
      showNotification('Not başarıyla silindi!', 'success');
      
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

function displayNotes(notes) {
  const notesList = document.querySelector('.notes-list');
  if (!notesList) return;
  
  if (notes.length === 0) {
    notesList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Henüz kaydedilmiş not yok.</p>';
    return;
  }
  
  notesList.innerHTML = notes.map(note => `
    <div class="note-card" onclick="loadNote(${note.id})" oncontextmenu="showContextMenu(event, ${note.id})">
      <div class="note-header">
        <h4 class="note-title">
          ${note.isFavorite ? '<i class="bi bi-star-fill favorite-star"></i>' : ''}${note.title}
        </h4>
      </div>
      <p class="note-preview">
        ${(note.content || '').replace(/<[^>]*>/g, '').substring(0, 150)}...
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
        <div class="note-actions"></div>
      </div>
    </div>
  `).join('');
}

// Save note button event listener
$('save-note-btn').addEventListener('click', async () => {
  try {
    await saveNote();
    console.log('Note saved successfully');
  } catch (error) {
    console.error('Error saving note:', error);
    alert('Not kaydedilirken hata oluştu: ' + error.message);
  }
});

// Make functions globally available
window.deleteNote = deleteNote;
window.loadNote = loadNote;
window.showContextMenu = showContextMenu;

// Global click handler for context menu and popups (capture phase)
document.addEventListener('click', function(e) {
  const contextMenu = document.getElementById('context-menu');
  if (contextMenu && !contextMenu.classList.contains('d-none')) {
    hideContextMenu();
  }
  
  // Close popups when clicking outside
  const popups = [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup,listOptionsPopup,parentNotePopup];
 
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
							   e.target.id === 'list-options-btn';
      
      if (!isClickInsidePopup && !isClickOnTrigger) {
		closePopup(popup);
      }
    }
  });
}, true);

// Toggle notes panel visibility
function toggleNotesPanel() {
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
      if (resizeIcon) resizeIcon.className = 'bi bi-arrows-angle-expand';
    } else {
      // Kapat
      notesPanel.style.width = '0px';
      notesPanel.style.opacity = '0';
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
      updateRequest.onsuccess = () => {
        loadNotes(); // Refresh the notes list
        
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
  // Get note data to check if it's favorite
  if (db) {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(noteId);
    
    request.onsuccess = () => {
      if (request.result) {
        const note = request.result;
        const favoriteItem = document.querySelector('[data-action="favorite"] span');
        if (favoriteItem) {
          favoriteItem.textContent = note.isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle';
        }
      }
    };
  }
}

function showContextMenu(event, noteId) {
  event.preventDefault();
  currentNoteId = noteId;
  
  // Update context menu text based on note's favorite status
  updateContextMenuText(noteId);
  
  const contextMenu = document.getElementById('context-menu');
  contextMenu.style.left = event.pageX + 'px';
  contextMenu.style.top = event.pageY + 'px';
  contextMenu.classList.remove('d-none');
}

function hideContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  contextMenu.classList.add('d-none');
}

function handleContextAction(action) {
  if (!currentNoteId) return;
  
  switch(action) {
    case 'copy':
      copyNote(currentNoteId);
      break;
    case 'delete':
      deleteNote(currentNoteId);
      break;
    case 'favorite':
      toggleFavorite(currentNoteId);
      break;
    case 'archive':
      console.log('Archive note:', currentNoteId);
      break;
  }
  
  hideContextMenu();
}

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
  const resizeBtn = document.getElementById('resizeBtn');
  if (resizeBtn) {
    resizeBtn.addEventListener('click', toggleNotesPanel);
  }
  
  
  // Checklist event delegation'ı başlat
  initChecklistEventDelegation();
  
  // Context menu item clicks
  document.querySelectorAll('.context-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      handleContextAction(action);
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
    
    // Load view preferences after notes are loaded
    loadViewPreferences();
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
    console.log('Toggled checklist item:', itemId, checklistItems[itemIndex].completed);
  }
};

// checkListBtn click handler
document.getElementById('checklistBtn').onclick = () => {
  toggleChecklistView();
};

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
    console.log('Removed checklist item:', itemId);
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
      console.log('Saved checklist item text:', itemId, text);
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

// Global variables to track view states (loaded from localStorage)
let isCompactView = false;
let showChecklistCount = false;

// Global variable to track current sort option
let currentSortOption = 'updated'; // default: updatedAt
let currentSortDirection = 'desc'; // default: descending

// Track sort directions for each option
let sortDirections = {
  title: 'desc',
  created: 'desc', 
  updated: 'desc'
};

// Load view preferences from localStorage
function loadViewPreferences() {
  isCompactView = localStorage.getItem('noteflix-compact-view') === 'true';
  showChecklistCount = localStorage.getItem('noteflix-show-checklist-count') === 'true';
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
  
  // Apply saved preferences
  applyViewPreferences();
}

// Save view preferences to localStorage
function saveViewPreferences() {
  localStorage.setItem('noteflix-compact-view', isCompactView.toString());
  localStorage.setItem('noteflix-show-checklist-count', showChecklistCount.toString());
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
  
  console.log('Compact view:', isCompactView ? 'enabled' : 'disabled');
}

// Toggle checklist count display for note list
function toggleChecklistCount() {
  showChecklistCount = !showChecklistCount;
  
  // Save to localStorage
  saveViewPreferences();
  
  // Apply the change
  applyViewPreferences();
  
  console.log('Checklist count display:', showChecklistCount ? 'enabled' : 'disabled');
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
  
  console.log('Notes sorted by:', currentSortOption, currentSortDirection.toUpperCase());
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
          console.log('Due date saved:', currentDueDateItemId, dueDateTime);
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
        console.log('Due date cleared:', currentDueDateItemId);
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