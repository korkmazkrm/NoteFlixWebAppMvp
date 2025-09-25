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

const editor = new Editor({
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

function openPopup(p) { p.classList.remove('d-none'); p.classList.add('d-flex'); }
function closePopup(p) { p.classList.add('d-none'); p.classList.remove('d-flex'); }
function positionPopupAt(popup, rect) {
  let margin = 5;
  let top  = rect.bottom + window.scrollY + margin;
  let left = rect.left + window.scrollX;	  	  
  popup.style.top = top + 'px';
  popup.style.left = left + 'px';
}

function closeAllPopups() {
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
}

/* ---------- Toolbar actions ---------- */
$('bold-btn').onclick = () => { editor.chain().focus().toggleBold().run(); };
$('italic-btn').onclick = () => { editor.chain().focus().toggleItalic().run(); };
$('underline-btn').onclick = () => { editor.chain().focus().toggleUnderline().run(); };
$('strike-btn').onclick = () => { editor.chain().focus().toggleStrike().run(); };

/* ---------- Actions popup ---------- */
$('actions-btn').onclick = (e) => {
  e.stopPropagation();
  [headingPopup,listPopup,alignPopup,palettePopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
  const isOpen = !actionsPopup.classList.contains('d-none');
  if (isOpen) { closePopup(actionsPopup); }
  else { positionPopupAt(actionsPopup, actionsBtn.getBoundingClientRect());openPopup(actionsPopup); }
};

$('undo-btn').onclick = () => { editor.chain().focus().undo().run(); };
$('redo-btn').onclick = () => { editor.chain().focus().redo().run(); };
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
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
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
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,imagePopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
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
  [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
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
  [listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
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
  [headingPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
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
  [headingPopup,listPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
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
  [headingPopup,listPopup,alignPopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup].forEach(closePopup);
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
      }
    };
  });
}

async function saveNote() {
  if (!db) await initDB();
  
  const title = $('note-title').value.trim();
  const content = editor.getHTML();
  const now = new Date().toISOString();
  
  // Başlık zorunlu kontrolü
  if (!title) {
    showNotification('Lütfen not başlığı giriniz!', 'info');
    $('note-title').focus();
    return;
  }
  
  console.log('Saving note with content:', content);
  console.log('Content length:', content.length);
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
        editor.commands.clearContent();
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
      const notes = request.result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      displayNotes(notes);
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
        
        $('note-title').value = note.title || '';
        
        // Content'i yükle ve resimleri kontrol et
        const content = note.content || '';
        console.log('Setting content to editor:', content);
        
        // Editor'ü temizle ve yeni içeriği yükle
        editor.commands.clearContent();
        editor.commands.setContent(content, false);
        
        // Kısa bir gecikme sonrası focus
        setTimeout(() => {
          editor.commands.focus();
          // Sayaç güncelle
          updateEditorCounter();
        }, 100);
        
        resolve(note);
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
  editor.commands.clearContent();
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
  const divider = document.getElementById('panel-divider');
  const notesPanel = document.querySelector('.notes-panel');
  const editorPanel = document.querySelector('.editor-panel');
  
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
        editor.commands.clearContent();
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
        <h4 class="note-title">${note.title}</h4>
        <button class="note-delete-btn" onclick="event.stopPropagation(); deleteNote(${note.id})" title="Sil">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <p class="note-preview">
        ${(note.content || '').replace(/<[^>]*>/g, '').substring(0, 150)}...
      </p>
      <div class="note-date">
        ${new Date(note.updatedAt).toLocaleString('tr-TR', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
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
  const popups = [headingPopup,listPopup,alignPopup,palettePopup,actionsPopup,urlPopup,videoPopup,imagePopup,textPopup,bgPopup,commandPopup];
 
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
 							   e.target.id === 'image-btn';
      
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

function showContextMenu(event, noteId) {
  event.preventDefault();
  currentNoteId = noteId;
  
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
      console.log('Favorite note:', currentNoteId);
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
  
  // Panel resizer'ı başlat
  initPanelResizer();
  
  // Context menu item clicks
  document.querySelectorAll('.context-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      handleContextAction(action);
    });
  });
});

// Initialize database and load notes on page load
window.addEventListener('load', async () => {
  try {
    await initDB();
    await loadNotes();
  } catch (error) {
    console.error('Error initializing database:', error);
  }
});
