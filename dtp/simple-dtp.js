
/*! SimpleDTP v1.4.0 — Vanilla JS Date/Time Picker (Modal & Inline)
 *  MIT License — no deps
 *  New:
 *   - locale support (TR & EN built-in)
 *   - Localized months, weekdays, header title, buttons, aria labels
 *   - If `title` is not provided, locale's default title is used
 *   - If `weekStart` not provided, taken from locale
 *
 *  Previous:
 *   - v1.3.0: title/showHeader + setTitle()
 *   - v1.2.0: enableTime/minuteStep/time24hr
 *   - v1.1.0: ESC/overlay cancel, showCancel
 */
(function (global) {
  'use strict';

  const LOCALES = {
    tr: {
      title: 'Tarih Seç',
      months: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
      // Sun-first kısa isimler; weekStart değeri ile döndürülecek
      dowsShortSunFirst: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
      weekStart: 1, // Pazartesi
      buttons: { today: 'Bugün', cancel: 'İptal', ok: 'Tamam' },
      aria: { incHour:'Saat artır', decHour:'Saat azalt', incMinute:'Dakika artır', decMinute:'Dakika azalt' }
    },
    en: {
      title: 'Select date',
      months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      dowsShortSunFirst: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      weekStart: 0, // Sunday (common in EN/US)
      buttons: { today: 'Today', cancel: 'Cancel', ok: 'OK' },
      aria: { incHour:'Increase hour', decHour:'Decrease hour', incMinute:'Increase minute', decMinute:'Decrease minute' }
    }
  };

  function rotate(arr, n){
    const k = ((n % arr.length) + arr.length) % arr.length;
    return arr.slice(k).concat(arr.slice(0, k));
  }

  const defaults = {
    locale: 'tr',                 // NEW: 'tr' | 'en'
    weekStart: undefined,         // if undefined -> from locale
    months: undefined,            // allow override
    dowsShortSunFirst: undefined, // allow override
    format: 'dd.MM.yyyy',         // can be 'dd.MM.yyyy HH:mm'
    title: undefined,             // if undefined -> from locale
    showHeader: true,
    showToday: true,
    showCancel: true,
    closeOnOverlayClick: true,
    enableTime: false,
    time24hr: true,
    minuteStep: 5,
    min: null,
    max: null,
    value: null,
    attachTo: null,
    onConfirm: null,
    onCancel: null,
    mode: 'modal',   // 'modal' | 'inline'
    mount: null
  };

  const pad = n => String(n).padStart(2,'0');
  const sameDay = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  const daysInMonth = (y,m) => new Date(y, m+1, 0).getDate();
  const clampDate = (d, min, max) => {
    if (min && d < min) return new Date(min);
    if (max && d > max) return new Date(max);
    return d;
  };
  function fmt(date, pattern) {
    return pattern
      .replace(/yyyy/g, String(date.getFullYear()))
      .replace(/MM/g, pad(date.getMonth()+1))
      .replace(/dd/g, pad(date.getDate()))
      .replace(/HH/g, pad(date.getHours()))
      .replace(/mm/g, pad(date.getMinutes()));
  }

  class SimpleDTP {
    constructor(options = {}) {
      this.opts = Object.assign({}, defaults, options);

      // Resolve locale + allow per-instance overrides
      const baseLoc = LOCALES[this.opts.locale] || LOCALES.tr;
      this.loc = {
        title: this.opts.title ?? baseLoc.title,
        months: this.opts.months ?? baseLoc.months,
        dowsShortSunFirst: this.opts.dowsShortSunFirst ?? baseLoc.dowsShortSunFirst,
        buttons: baseLoc.buttons,
        aria: baseLoc.aria,
        weekStart: this.opts.weekStart ?? baseLoc.weekStart
      };

      this.today = new Date();
      this.today.setSeconds(0,0);

      const initial = this.opts.value ? new Date(this.opts.value) : new Date(this.today);
      const initDay = new Date(initial.getFullYear(), initial.getMonth(), initial.getDate());
      this.selected = clampDate(initDay, this.opts.min, this.opts.max);
      this.view = new Date(this.selected.getFullYear(), this.selected.getMonth(), 1);

      // time state
      this.h = initial.getHours() || 0;
      this.m = Math.floor((initial.getMinutes() || 0)/this.opts.minuteStep)*this.opts.minuteStep;

      this._build();
      this._wire();
      if (this.opts.attachTo) this._attachTrigger(this.opts.attachTo);
    }

    _attachTrigger(target) {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return;
      el.addEventListener('click', () => this.open());
    }

    _build() {
      if (this.opts.mode === 'inline') {
        const mount = this.opts.mount || document.createElement('div');
        if (!this.opts.mount) document.body.appendChild(mount);
        mount.classList.add('sdtp-inline');
        this.container = mount;
      } else {
        // modal
        this.overlay = document.createElement('div');
        this.overlay.className = 'sdtp-overlay';
        this.container = document.createElement('div');
        this.container.className = 'sdtp-modal';
        this.overlay.appendChild(this.container);
        document.body.appendChild(this.overlay);
      }

      // header (optional)
      if (this.opts.showHeader) {
        const header = document.createElement('header');
        this.titleEl = document.createElement('div');
        this.titleEl.className = 'sdtp-title';
        this.titleEl.textContent = this.loc.title;
        header.appendChild(this.titleEl);
        this.container.appendChild(header);
      }

      // MAIN area (calendar + optional time)
      const main = document.createElement('div');
      main.className = 'sdtp-main';

      // calendar shell
      const cal = document.createElement('div');
      cal.className = 'sdtp-cal';
      cal.innerHTML = `
        <div class="sdtp-cal-top">
          <button class="sdtp-nav" data-nav="-1" aria-label="Prev month">‹</button>
          <div class="sdtp-month" aria-live="polite"></div>
          <button class="sdtp-nav" data-nav="1" aria-label="Next month">›</button>
        </div>
        <div class="sdtp-grid sdtp-dow-row"></div>
        <div class="sdtp-grid sdtp-days" aria-label="Days"></div>
      `;
      main.appendChild(cal);

      // time panel (optional)
      if (this.opts.enableTime) {
        const time = document.createElement('div');
        time.className = 'sdtp-time';
        time.innerHTML = `
          <div class="sdtp-spin" data-kind="hour">
            <button class="sdtp-up" aria-label="${this.loc.aria.incHour}"></button>
            <div class="sdtp-box sdtp-hour">00</div>
            <button class="sdtp-down" aria-label="${this.loc.aria.decHour}"></button>
          </div>
          <div class="sdtp-colon">:</div>
          <div class="sdtp-spin" data-kind="minute">
            <button class="sdtp-up" aria-label="${this.loc.aria.incMinute}"></button>
            <div class="sdtp-box sdtp-minute">00</div>
            <button class="sdtp-down" aria-label="${this.loc.aria.decMinute}"></button>
          </div>
        `;
        main.appendChild(time);
        this.timePanel = time;
      }
      this.container.appendChild(main);

      // footer
      const footer = document.createElement('div');
      footer.className = 'sdtp-footer';
      const left = document.createElement('div');
      const right = document.createElement('div'); right.className = 'right';

      if (this.opts.showToday) {
        this.btnToday = document.createElement('button');
        this.btnToday.className = 'sdtp-btn secondary';
        this.btnToday.type = 'button';
        this.btnToday.textContent = this.loc.buttons.today;
        left.appendChild(this.btnToday);
      }

      if (this.opts.showCancel) {
        this.btnCancel = document.createElement('button');
        this.btnCancel.className = 'sdtp-btn secondary';
        this.btnCancel.type = 'button';
        this.btnCancel.textContent = this.loc.buttons.cancel;
        right.appendChild(this.btnCancel);
      }

      this.btnOk = document.createElement('button');
      this.btnOk.className = 'sdtp-btn';
      this.btnOk.type = 'button';
      this.btnOk.textContent = this.loc.buttons.ok;
      right.appendChild(this.btnOk);

      footer.appendChild(left);
      footer.appendChild(right);
      this.container.appendChild(footer);

      // refs
      this.monthLabel = this.container.querySelector('.sdtp-month');
      this.dowRow = this.container.querySelector('.sdtp-dow-row');
      this.daysGrid = this.container.querySelector('.sdtp-days');
      this.navButtons = this.container.querySelectorAll('.sdtp-nav');
      this.hourBox = this.container.querySelector('.sdtp-hour');
      this.minuteBox = this.container.querySelector('.sdtp-minute');

      // render static
      this._renderDOW();
      this._renderMonth();
      this._renderTime();
    }

    _wire() {
      // nav
      this.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const step = Number(btn.dataset.nav);
          this.view = new Date(this.view.getFullYear(), this.view.getMonth()+step, 1);
          this._renderMonth();
          this._focusSelected();
        });
      });

      // day click / key
      this.daysGrid.addEventListener('click', (e) => this._onPick(e));
      this.daysGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._onPick(e); }
      });

      // footer
      if (this.btnToday) {
        this.btnToday.addEventListener('click', () => {
          const inRange = (d, min, max) => (!min || d>=min) && (!max || d<=max);
          const t = new Date();
          t.setSeconds(0,0);
          const tDay = new Date(t.getFullYear(), t.getMonth(), t.getDate());
          if (inRange(tDay, this.opts.min, this.opts.max)) {
            this.selected = tDay;
            this.view = new Date(tDay.getFullYear(), tDay.getMonth(), 1);
            this._renderMonth();
            this._focusSelected();
          } else {
            this.view = new Date(tDay.getFullYear(), tDay.getMonth(), 1);
            this._renderMonth();
          }
        });
      }

      if (this.btnCancel) {
        this.btnCancel.addEventListener('click', () => this.close('cancel'));
      }
      this.btnOk.addEventListener('click', () => {
        const dt = this._composeDate();
        const str = fmt(dt, this.opts.format);
        this.close('confirm');
        if (typeof this.opts.onConfirm === 'function') this.opts.onConfirm(dt, str, this);
      });

      // overlay close
      if (this.overlay && this.opts.closeOnOverlayClick) {
        this.overlay.addEventListener('mousedown', (e) => {
          if (e.target === this.overlay) this.close('cancel');
        });
      }

      // esc
      this._escHandler = (e) => { if (e.key === 'Escape') this.close('cancel'); };

      // time spins
      if (this.timePanel) {
        this.timePanel.addEventListener('click', (e) => {
          const up = e.target.closest('.sdtp-up');
          const down = e.target.closest('.sdtp-down');
          const spin = e.target.closest('.sdtp-spin');
          if (!spin) return;
          const kind = spin.dataset.kind;
          if (up) this._inc(kind);
          if (down) this._dec(kind);
        });
        // mouse wheel support
        this.timePanel.addEventListener('wheel', (e) => {
          const box = e.target.closest('.sdtp-box');
          if (!box) return;
          const kind = box.classList.contains('sdtp-hour') ? 'hour' : 'minute';
          if (e.deltaY < 0) this._inc(kind);
          else this._dec(kind);
          e.preventDefault();
        }, {passive:false});
        // keyboard on box focus
        [this.hourBox, this.minuteBox].forEach((el) => {
          if (!el) return;
          el.setAttribute('tabindex', '0');
          el.addEventListener('keydown', (e) => {
            const kind = el.classList.contains('sdtp-hour') ? 'hour' : 'minute';
            if (e.key === 'ArrowUp') { this._inc(kind); e.preventDefault(); }
            if (e.key === 'ArrowDown') { this._dec(kind); e.preventDefault(); }
          });
        });
      }
    }

    _renderDOW() {
      this.dowRow.innerHTML = '';
      // rotate labels according to weekStart
      const labels = rotate(this.loc.dowsShortSunFirst, this.loc.weekStart);
      labels.forEach(txt => {
        const el = document.createElement('div');
        el.className = 'sdtp-dow';
        el.textContent = txt;
        this.dowRow.appendChild(el);
      });
    }

    _renderMonth() {
      const y = this.view.getFullYear();
      const m = this.view.getMonth();
      this.monthLabel.textContent = `${this.loc.months[m]} ${y}`;

      const first = new Date(y,m,1);
      const startOffset = (first.getDay() - this.loc.weekStart + 7) % 7;
      const dim = daysInMonth(y,m);
      const dimPrev = daysInMonth(y, m-1);

      let html = '';
      for (let i=0; i<42; i++){
        let dayNum, monthOffset;
        if (i < startOffset){
          dayNum = dimPrev - startOffset + 1 + i; monthOffset = -1;
        } else if (i >= startOffset + dim){
          dayNum = i - (startOffset + dim) + 1; monthOffset = +1;
        } else {
          dayNum = i - startOffset + 1; monthOffset = 0;
        }
        const d = new Date(y, m + monthOffset, dayNum);
        d.setHours(0,0,0,0);

        const isMuted = monthOffset !== 0;
        const isToday = sameDay(d, new Date());
        const isSelected = sameDay(d, this.selected);

        const disabled = (this.opts.min && d < this._stripTime(this.opts.min)) ||
                         (this.opts.max && d > this._stripTime(this.opts.max));

        html += `<div class="sdtp-day${isMuted?' sdtp-muted':''}${isToday?' sdtp-today':''}${isSelected?' sdtp-selected':''}${disabled?' sdtp-disabled':''}"
                    data-ymd="${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}"
                    data-mo="${monthOffset}" ${disabled?'aria-disabled="true"':''} tabindex="0">${d.getDate()}</div>`;
      }
      this.daysGrid.innerHTML = html;
    }

    _renderTime(){
      if (!this.timePanel) return;
      if (this.hourBox) this.hourBox.textContent = pad(this.h);
      if (this.minuteBox) this.minuteBox.textContent = pad(this.m);
    }

    _stripTime(d){ const x = new Date(d); x.setHours(0,0,0,0); return x; }

    _composeDate(){
      const dt = new Date(this.selected.getFullYear(), this.selected.getMonth(), this.selected.getDate(),
                          this.opts.enableTime ? this.h : 0,
                          this.opts.enableTime ? this.m : 0, 0, 0);
      return dt;
    }

    _onPick(e){
      const cell = e.target.closest('.sdtp-day');
      if (!cell || cell.classList.contains('sdtp-disabled')) return;
      const [y,m,d] = cell.dataset.ymd.split('-').map(Number);
      const picked = new Date(y, m-1, d);
      picked.setHours(0,0,0,0);

      const mo = Number(cell.dataset.mo);
      if (mo !== 0) this.view = new Date(y, m-1, 1);

      this.selected = picked;
      this._renderMonth();
      this._focusSelected();
    }

    _focusSelected(){
      const el = this.container.querySelector('.sdtp-day.sdtp-selected');
      if (el) el.focus();
    }

    _inc(kind){
      if (kind === 'hour') {
        this.h = (this.h + 1) % 24;
      } else {
        this.m = (this.m + this.opts.minuteStep) % 60;
      }
      this._renderTime();
    }
    _dec(kind){
      if (kind === 'hour') {
        this.h = (this.h + 23) % 24;
      } else {
        this.m = (this.m - this.opts.minuteStep + 60) % 60;
      }
      this._renderTime();
    }

    open(){
      if (this.opts.mode === 'modal') {
        this.overlay.classList.add('sdtp-open');
        document.addEventListener('keydown', this._escHandler);
      }
      this._renderMonth();
      this._renderTime();
      this._focusSelected();
    }

    // reason: 'confirm' | 'cancel' | undefined
    close(reason){
      if (this.opts.mode === 'modal') {
        this.overlay.classList.remove('sdtp-open');
        document.removeEventListener('keydown', this._escHandler);
      }
      if (reason === 'cancel' && typeof this.opts.onCancel === 'function') {
        this.opts.onCancel(this);
      }
    }

    getDate(){ return this._composeDate(); }
    setDate(date){
      const d = new Date(date);
      const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const clamped = clampDate(dayOnly, this.opts.min, this.opts.max);
      this.selected = clamped;
      if (this.opts.enableTime) {
        this.h = d.getHours() || 0;
        this.m = Math.floor((d.getMinutes()||0)/this.opts.minuteStep)*this.opts.minuteStep;
      }
      this.view = new Date(clamped.getFullYear(), clamped.getMonth(), 1);
      this._renderMonth(); this._renderTime();
    }
    format(date){ return fmt(date, this.opts.format); }

    setTitle(text){
      if (!this.titleEl) return;
      this.titleEl.textContent = text;
    }

    destroy(){
      this.close();
      if (this.overlay) this.overlay.remove();
      if (this.opts.mode === 'inline' && this.container) this.container.remove();
    }
  }

  function create(options){ return new SimpleDTP(options); }
  global.SimpleDTP = { create };

})(typeof window !== 'undefined' ? window : this);
