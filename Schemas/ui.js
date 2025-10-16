export const qs = sel => document.querySelector(sel);
export const qsa = sel => Array.from(document.querySelectorAll(sel));

export function showModal(id) {
  const el = qs('#' + id);
  if (el) {
    // Modal'ı body'ye taşı
    document.body.appendChild(el);
    el.classList.add('show');
  }
}

export function closeModal(id) {
  const el = qs('#' + id);
  if (el) el.classList.remove('show');
}

/* --------------------------------------------------------
   Property satırı (şema tanımlama)
-------------------------------------------------------- */
export function propRowTemplate(p = { name: '', type: 'Text', options: [], isMandatory: false }) {
  const wrap = document.createElement('div');
  wrap.className = 'prop-row';
  wrap.innerHTML = `
    <input class="pname" placeholder="Property adı" value="${p.name || ''}" />
    <select class="ptype">
      <option ${p.type === 'Title' ? 'selected' : ''}>Title</option>
      <option ${p.type === 'Text' ? 'selected' : ''}>Text</option>
      <option ${p.type === 'Number' ? 'selected' : ''}>Number</option>
      <option ${p.type === 'Select' ? 'selected' : ''}>Select</option>
      <option ${p.type === 'Relation' ? 'selected' : ''}>Relation</option>
      <option ${p.type === 'Date' ? 'selected' : ''}>Date</option>
      <option ${p.type === 'DateTime' ? 'selected' : ''}>DateTime</option>
      <option ${p.type === 'Checkbox' ? 'selected' : ''}>Checkbox</option>
    </select>
    <input class="poptions" placeholder="Select için: Low, Medium, High" 
      value="${(p.options || []).join(', ')}" 
      ${p.type === 'Select' ? '' : 'disabled'} />
    <select class="prelatedschema" style="display: none;">
      <option value="">İlişkili şemayı seç...</option>
    </select>
    <label style="display: flex; align-items: center; gap: 4px; white-space: nowrap;">
      <input type="checkbox" class="pmandatory" ${p.isMandatory ? 'checked' : ''} />
      <span style="font-size: 13px;">Zorunlu</span>
    </label>
    <div class="row end"><button class="btn-sm btn-ghost">Sil</button></div>
  `;

  const typeSel = wrap.querySelector('.ptype');
  const opt = wrap.querySelector('.poptions');
  const relatedSchemaSelect = wrap.querySelector('.prelatedschema');

  // Şemaları yükle (Relation için)
  async function loadSchemasToDropdown() {
    // schema.js'den export edilen schemaStore'u kullanacağız
    if (window.getAllSchemas) {
      const schemas = await window.getAllSchemas();
      relatedSchemaSelect.innerHTML = '<option value="">İlişkili şemayı seç...</option>';
      schemas.forEach(s => {
        const option = document.createElement('option');
        option.value = s.name;
        option.textContent = s.name;
        if (p.relatedSchema === s.name) option.selected = true;
        relatedSchemaSelect.appendChild(option);
      });
    }
  }

  typeSel.addEventListener('change', () => {
    if (typeSel.value === 'Select') {
      opt.style.display = '';
      opt.disabled = false;
      opt.placeholder = 'Low, Medium, High';
      relatedSchemaSelect.style.display = 'none';
    } else if (typeSel.value === 'Relation') {
      opt.style.display = 'none';
      opt.disabled = true;
      opt.value = '';
      relatedSchemaSelect.style.display = '';
      loadSchemasToDropdown();
    } else {
      opt.style.display = '';
      opt.disabled = true;
      opt.value = '';
      relatedSchemaSelect.style.display = 'none';
    }
  });

  // İlk yükleme
  if (p.type === 'Relation') {
    opt.style.display = 'none';
    relatedSchemaSelect.style.display = '';
    loadSchemasToDropdown();
  }

  wrap.querySelector('button').addEventListener('click', () => wrap.remove());
  return wrap;
}

export function tableRow(values) {
  const tr = document.createElement('tr');
  tr.innerHTML = values;
  return tr;
}
