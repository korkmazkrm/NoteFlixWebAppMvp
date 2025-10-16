import { schemaStore, recordStore } from './db.js';
import { qs, qsa, showModal, closeModal, propRowTemplate, tableRow } from './ui.js';
import { renderRecordTable, openRecordModal } from './records.js';

let editMode = false;
let editingSchemaName = null;

// Global fonksiyon - Tüm şemaları almak için
window.getAllSchemas = async function() {
  return await schemaStore.getAll();
};

/* --------------------------------------------------------
   Şemaları tabloya render et
-------------------------------------------------------- */
async function renderSchemaTable() {
  const schemas = await schemaStore.getAll();
  const tb = qs('#schemaTable tbody');
  tb.innerHTML = '';

  schemas.sort((a, b) => a.name.localeCompare(b.name));

  for (const sc of schemas) {
    const propsSummary =
      (sc.properties || [])
        .map(p => `${p.name} (${p.type})`)
        .slice(0, 4)
        .join(', ') + ((sc.properties || []).length > 4 ? ' …' : '');

    const tr = tableRow(`
      <td>${sc.name}</td>
      <td>${sc.properties.length}</td>
      <td class="muted">${propsSummary}</td>
      <td>
        <div class="row">
          <button class="btn-sm" data-act="create">Kayıt Oluştur</button>
          <button class="btn-sm" data-act="edit">Düzenle</button>
          <button class="btn-sm btn-danger" data-act="del">Sil</button>
        </div>
      </td>
    `);

    tr.querySelector('[data-act="create"]').addEventListener('click', () => openRecordModal(sc));
    tr.querySelector('[data-act="edit"]').addEventListener('click', () => openSchemaModal(sc));
    tr.querySelector('[data-act="del"]').addEventListener('click', () => deleteSchemaFlow(sc.name));
    tb.appendChild(tr);
  }
}

/* --------------------------------------------------------
   Yeni / Düzenle Şema Modalı
-------------------------------------------------------- */
export function openSchemaModal(schema = null) {
  editMode = !!schema;
  editingSchemaName = schema ? schema.name : null;

  qs('#schemaModalTitle').textContent = editMode ? `Şemayı Düzenle: ${schema.name}` : 'Yeni Şema';
  qs('#schemaName').value = schema ? schema.name : '';

  const list = qs('#propList');
  list.innerHTML = '';
  const props = schema ? schema.properties || [] : [{ name: 'Title', type: 'Title', options: [] }];
  props.forEach(p => list.appendChild(propRowTemplate(p)));

  showModal('schemaModal');
}

/* --------------------------------------------------------
   Yeni property ekle / modal kapat
-------------------------------------------------------- */
qs('#btnNewSchema').addEventListener('click', () => openSchemaModal(null));
qs('#btnCloseSchema').addEventListener('click', () => closeModal('schemaModal'));
qs('#btnAddProp').addEventListener('click', () => qs('#propList').appendChild(propRowTemplate({})));

/* --------------------------------------------------------
   Şemayı Kaydet
-------------------------------------------------------- */
qs('#btnSaveSchema').addEventListener('click', async () => {
  const name = qs('#schemaName').value.trim();
  if (!name) {
    alert('Şema adı gerekli');
    return;
  }

  const rows = qsa('#propList .prop-row');
  const properties = rows
    .map(r => {
      const n = r.querySelector('.pname').value.trim();
      const t = r.querySelector('.ptype').value;
      const opts = (r.querySelector('.poptions').value || '')
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);
      const isMandatory = r.querySelector('.pmandatory').checked;
      const relatedSchema = r.querySelector('.prelatedschema').value;
      
      return { 
        name: n, 
        type: t, 
        options: opts, 
        isMandatory,
        relatedSchema: relatedSchema || undefined
      };
    })
    .filter(p => p.name);

  if (!properties.length) {
    alert('En az bir property ekleyin');
    return;
  }

  const existing = await schemaStore.getAll();
  const nameTaken = existing.some(s => s.name === name && (!editMode || s.name !== editingSchemaName));
  if (nameTaken) {
    alert('Bu isimde bir şema zaten var.');
    return;
  }

  if (editMode) {
    if (name !== editingSchemaName) {
      await recordStore.renameSchema(editingSchemaName, name);
      await schemaStore.delete(editingSchemaName);
    }
    await schemaStore.put({ name, properties });
  } else {
    await schemaStore.put({ name, properties });
  }

  closeModal('schemaModal');
  await renderSchemaTable();
});

/* --------------------------------------------------------
   Şema Silme (kayıtları opsiyonel)
-------------------------------------------------------- */
async function deleteSchemaFlow(schemaName) {
  if (!confirm(`"${schemaName}" şemasını silmek istiyor musunuz?`)) return;

  const withRecords = confirm(
    'Bu şemaya bağlı KAYITLARI da silelim mi? "Tamam" derseniz kayıtlar da silinir, "İptal" derseniz sadece şema silinir.'
  );

  await schemaStore.delete(schemaName);
  if (withRecords) await recordStore.deleteBySchema(schemaName);

  await renderSchemaTable();
  await renderRecordTable();
}

/* --------------------------------------------------------
   Şema Dışa / İçe Aktarım
-------------------------------------------------------- */
async function exportSchemas() {
  const list = await schemaStore.getAll();
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'schemas.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importSchemas(e) {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();

  try {
    const list = JSON.parse(text);
    if (!Array.isArray(list)) throw new Error('Geçersiz dosya');
    for (const sc of list) {
      if (sc && sc.name && Array.isArray(sc.properties)) await schemaStore.put(sc);
    }
    await renderSchemaTable();
    alert('Şemalar içe aktarıldı');
  } catch (err) {
    alert('Hata: ' + (err.message || err));
  }

  e.target.value = '';
}

/* --------------------------------------------------------
   Olaylar: dışa/içe aktarım
-------------------------------------------------------- */
qs('#btnExportSchemas').addEventListener('click', exportSchemas);
qs('#fileImportSchemas').addEventListener('change', importSchemas);

/* --------------------------------------------------------
   Başlangıç yükleme
-------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', async () => {
  await renderSchemaTable();
  await renderRecordTable();
});
