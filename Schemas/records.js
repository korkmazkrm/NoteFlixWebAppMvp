import { recordStore } from './db.js';
import { qs, tableRow, showModal, closeModal } from './ui.js';

let activeSchema = null;
let editMode = false;
let editingRecordId = null;

/* --------------------------------------------------------
   Kayıtları tabloya render et
-------------------------------------------------------- */
export async function renderRecordTable() {
  const recs = await recordStore.all();
  const allRecords = recs; // Relation'lar için tüm kayıtlar
  const allSchemas = await window.getAllSchemas(); // Tüm şemalar
  const tb = qs('#recordTable tbody');
  tb.innerHTML = '';

  if (!recs.length) {
    tb.innerHTML = '<tr><td colspan="3" class="muted">Henüz kayıt yok.</td></tr>';
    return;
  }

  recs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const r of recs) {
    // Bu kaydın şemasını bul
    const schema = allSchemas.find(s => s.name === r.schema);
    
    // Data'yı göster (Relation ID'lerini title'a çevir)
    const dataEntries = await Promise.all(
      Object.entries(r.data || {}).map(async ([k, v]) => {
        // Bu property Relation mi kontrol et
        const prop = schema?.properties?.find(p => p.name === k);
        if (prop && prop.type === 'Relation' && v) {
          // ID'yi title'a çevir
          const relatedRecord = allRecords.find(rec => rec.id == v);
          if (relatedRecord) {
            const titleProp = relatedRecord.data.Title || relatedRecord.data[Object.keys(relatedRecord.data)[0]] || `Kayıt #${v}`;
            return `${k}: ${titleProp}`;
          } else {
            return `${k}: Silinmiş Kayıt (#${v})`;
          }
        }
        return `${k}: ${v}`;
      })
    );
    
    const vals = dataEntries.join(', ');
    
    // Otomatik alanları da ekle
    const autoFields = [];
    if (r.createdTime) autoFields.push(`Oluşturulma: ${r.createdTime}`);
    if (r.createdBy) autoFields.push(`Oluşturan: ${r.createdBy}`);
    if (r.lastEditedTime) autoFields.push(`Son Düzenleme: ${r.lastEditedTime}`);
    if (r.lastEditedBy) autoFields.push(`Son Düzenleyen: ${r.lastEditedBy}`);
    
    const allVals = [vals, ...autoFields].filter(Boolean).join(', ');

    const tr = tableRow(`
      <td>${r.schema}</td>
      <td>${allVals}</td>
      <td>
        <div class="row">
          <span class="muted">${new Date(r.createdAt || Date.now()).toLocaleString()}</span>
          <button class="btn-sm" data-act="edit">Düzenle</button>
          <button class="btn-sm btn-danger" data-act="del">Sil</button>
        </div>
      </td>
    `);

    tr.querySelector('[data-act="edit"]').addEventListener('click', () => openRecordModalForEdit(r));
    tr.querySelector('[data-act="del"]').addEventListener('click', () => deleteRecord(r.id));
    tb.appendChild(tr);
  }
}

/* --------------------------------------------------------
   Yeni Kayıt Modalı
-------------------------------------------------------- */
export function openRecordModal(schema) {
  activeSchema = schema;
  editMode = false;
  editingRecordId = null;

  qs('#recordModalTitle').textContent = `Yeni Kayıt • ${schema.name}`;
  buildForm(schema, {});
  showModal('recordModal');
}

/* --------------------------------------------------------
   Düzenleme Modalı
-------------------------------------------------------- */
function openRecordModalForEdit(record) {
  editMode = true;
  editingRecordId = record.id;
  activeSchema = { name: record.schema, properties: [] };

  const allSchemas = JSON.parse(localStorage.getItem('schemasCache') || '[]');
  const schemaObj = allSchemas.find(s => s.name === record.schema);
  if (schemaObj) activeSchema = schemaObj;

  qs('#recordModalTitle').textContent = `Kayıt Düzenle • ${record.schema}`;
  buildForm(activeSchema, record.data);
  showModal('recordModal');
}

/* --------------------------------------------------------
   Form oluşturucu (şema bazlı)
-------------------------------------------------------- */
function buildForm(schema, existingData = {}) {
  const form = qs('#recordForm');
  form.innerHTML = '';

  (schema.properties || []).forEach(p => {
    const row = document.createElement('div');
    row.className = 'grid';
    const lab = document.createElement('label');
    const mandatoryMark = p.isMandatory ? '<span style="color: #ff4444; margin-left: 4px;">*</span>' : '';
    lab.innerHTML = `<span class="muted">${p.name} (${p.type})${mandatoryMark}</span>`;
    let field;

    switch (p.type) {
      case 'Number':
        field = document.createElement('input');
        field.type = 'number';
        field.step = 'any';
        break;

      case 'Select':
        field = document.createElement('select');
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '—';
        field.appendChild(blank);
        (p.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          field.appendChild(o);
        });
        break;

      case 'Date':
        // Sadece tarih picker
        const dateWrapper = document.createElement('div');
        dateWrapper.className = 'row';
        const dateTextInput = document.createElement('input');
        dateTextInput.type = 'text';
        dateTextInput.placeholder = 'YYYY-MM-DD';
        dateTextInput.dataset.prop = p.name;
        dateTextInput.value = existingData[p.name] || '';

        const datePicker = document.createElement('input');
        datePicker.type = 'date';
        datePicker.style.display = 'none';

        const dateBtn = document.createElement('button');
        dateBtn.textContent = '📅';
        dateBtn.type = 'button';
        dateBtn.className = 'btn-sm';
        dateBtn.style.marginLeft = '4px';

        dateBtn.addEventListener('click', () => {
          datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
        });

        datePicker.addEventListener('change', () => {
          dateTextInput.value = datePicker.value;
        });

        dateWrapper.appendChild(dateTextInput);
        dateWrapper.appendChild(dateBtn);
        dateWrapper.appendChild(datePicker);
        field = dateWrapper;
        break;

      case 'DateTime':
        // Manuel giriş + datetime picker
        const wrapper = document.createElement('div');
        wrapper.className = 'row';
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = 'YYYY-MM-DD HH:mm';
        textInput.dataset.prop = p.name;
        textInput.value = existingData[p.name] || '';

        const picker = document.createElement('input');
        picker.type = 'datetime-local';
        picker.style.display = 'none';

        const btn = document.createElement('button');
        btn.textContent = '🕓';
        btn.type = 'button';
        btn.className = 'btn-sm';
        btn.style.marginLeft = '4px';

        btn.addEventListener('click', () => {
          picker.showPicker ? picker.showPicker() : picker.click();
        });

        picker.addEventListener('change', () => {
          const val = picker.value.replace('T', ' ');
          textInput.value = val;
        });

        wrapper.appendChild(textInput);
        wrapper.appendChild(btn);
        wrapper.appendChild(picker);
        field = wrapper;
        break;

      case 'Relation':
        // İlişkili şemanın kayıtlarını listele
        field = document.createElement('select');
        field.dataset.prop = p.name;
        field.style.width = '100%';
        field.style.padding = '8px';
        field.style.borderRadius = '8px';
        field.style.border = '1px solid var(--line)';
        field.style.background = '#0f1520';
        field.style.color = 'var(--ink)';

        // Boş seçenek
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '— Seçiniz —';
        field.appendChild(emptyOption);

        // İlişkili şemanın kayıtlarını yükle
        (async () => {
          if (p.relatedSchema) {
            const allRecords = await recordStore.all();
            const relatedRecords = allRecords.filter(r => r.schema === p.relatedSchema);
            
            relatedRecords.forEach(rec => {
              const option = document.createElement('option');
              option.value = rec.id;
              // Title property'sini veya ilk property'yi göster
              const titleProp = rec.data.Title || rec.data[Object.keys(rec.data)[0]] || `Kayıt #${rec.id}`;
              option.textContent = titleProp;
              
              // Mevcut değeri seçili yap
              if (existingData[p.name] == rec.id) {
                option.selected = true;
              }
              
              field.appendChild(option);
            });
          }
        })();
        break;

      case 'Checkbox':
        field = document.createElement('input');
        field.type = 'checkbox';
        break;

      default:
        field = document.createElement('input');
        field.type = 'text';
    }

    if (p.type === 'Checkbox') field.checked = !!existingData[p.name];
    else if (p.type !== 'Date' && p.type !== 'DateTime' && existingData[p.name] !== undefined)
      field.value = existingData[p.name];

    // data-prop attribute'unu ekle (Date, DateTime ve Relation tipleri hariç, onlar zaten eklenmiş)
    if (p.type !== 'Date' && p.type !== 'DateTime' && p.type !== 'Relation') {
      field.dataset.prop = p.name;
    }

    row.appendChild(lab);
    row.appendChild(field);
    form.appendChild(row);
  });
}

/* --------------------------------------------------------
   Kaydet / Güncelle
-------------------------------------------------------- */
qs('#btnSaveRecord').addEventListener('click', async () => {
  if (!activeSchema) {
    alert('Önce bir şema seçin');
    return;
  }

  const data = {};
  document.querySelectorAll('#recordForm [data-prop]').forEach(el => {
    if (el.type === 'checkbox') {
      data[el.dataset.prop] = el.checked;
    } else {
      data[el.dataset.prop] = el.value;
    }
  });

  // Zorunlu alanları kontrol et
  const missingFields = [];
  activeSchema.properties.forEach(p => {
    if (p.isMandatory) {
      const value = data[p.name];
      // Checkbox hariç, boş değerleri kontrol et
      if (p.type !== 'Checkbox' && (!value || value.trim() === '')) {
        missingFields.push(p.name);
      }
    }
  });

  if (missingFields.length > 0) {
    alert('Zorunlu alanlar doldurulmalı:\n• ' + missingFields.join('\n• '));
    return;
  }

  if (editMode && editingRecordId != null) {
    const now = Date.now();
    await updateRecord(editingRecordId, { 
      data,
      lastEditedTime: new Date(now).toLocaleString(),
      lastEditedBy: 'Admin'
    });
  } else {
    const now = Date.now();
    await recordStore.add({
      schema: activeSchema.name,
      data,
      createdAt: now,
      // Otomatik alanlar
      createdTime: new Date(now).toLocaleString(),
      createdBy: 'Admin',
      lastEditedTime: new Date(now).toLocaleString(),
      lastEditedBy: 'Admin'
    });
  }

  closeModal('recordModal');
  await renderRecordTable();
});

/* --------------------------------------------------------
   Güncelle / Sil
-------------------------------------------------------- */
async function updateRecord(id, updatedFields) {
  const all = await recordStore.all();
  const target = all.find(r => r.id === id);
  if (!target) {
    alert('Kayıt bulunamadı');
    return;
  }

  const newRec = { ...target, ...updatedFields };
  await recordStore.add(newRec);
}

async function deleteRecord(id) {
  if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
  await deleteRecordById(id);
  await renderRecordTable();
}

async function deleteRecordById(id) {
  return new Promise(async resolve => {
    const db = await new Promise(res => {
      const req = indexedDB.open('notion_like_db_modular_v1', 1);
      req.onsuccess = () => res(req.result);
    });
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').delete(id);
    tx.oncomplete = () => resolve();
  });
}

/* --------------------------------------------------------
   Modal kapatma + cache
-------------------------------------------------------- */
qs('#btnCloseRecord').addEventListener('click', () => closeModal('recordModal'));

window.addEventListener('DOMContentLoaded', async () => {
  await renderRecordTable();
  const dbReq = indexedDB.open('notion_like_db_modular_v1', 1);
  dbReq.onsuccess = () => {
    const db = dbReq.result;
    const tx = db.transaction('schemas', 'readonly');
    const st = tx.objectStore('schemas');
    const req = st.getAll();
    req.onsuccess = () => {
      localStorage.setItem('schemasCache', JSON.stringify(req.result || []));
    };
  };
});
