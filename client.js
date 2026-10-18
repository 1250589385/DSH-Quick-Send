/**
 * Client half of dsh-quick-send.
 *
 * Layout
 * ------
 * Everything lives in the `conversation.composer.dock` seat — the ambient row
 * under the composer card. That row is a flex container whose only other child
 * is the host's context meter (context progress), which renders *after* the
 * slot. Giving this group `order: 1` therefore places it to the RIGHT of the
 * context meter; `order: 0` puts it to the left. Nothing floats over the
 * transcript, so the plugin cannot cover the conversation.
 *
 * The group is [shortcut chips…] [gear]. The gear opens the editor, which is
 * rendered in the frame-wide `shell.overlay` layer so it can never be clipped by
 * the transcript scroller or push the page taller.
 *
 * Moving
 * ------
 * Right-clicking the group enters move mode. The group becomes draggable; drag
 * left or right and release to snap it to the left or right of the context
 * meter. The choice persists in `localStorage`. Escape cancels.
 *
 * Sending uses the same Client API as the official composer:
 * `ctx.sessions.binding(sessionId).session.prompt(content, 'queue')`.
 *
 * Registration is a lazy factory with no side effects; styles, dictionaries,
 * and slot injections are registered inside `apply` so the framework disposes
 * them.
 */
window.__ModuleLoader__.load({
  id: 'dsh-quick-send',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;
    const useRef = React.useRef;
    const useCallback = React.useCallback;
    const useSyncExternalStore = React.useSyncExternalStore;

    const NS = 'dsh.quickSend';
    const STORAGE_KEY = 'dsh-quick-send.shortcuts.v1';
    const PLACEMENT_KEY = 'dsh-quick-send.placement.v1';

    /* ---------------------------------------------------------------- locale */

    const en = {
      trigger: 'Quick send shortcuts',
      close: 'Close',
      empty: 'No shortcuts yet — click \u2699 to add one.',
      add: 'Add',
      reset: 'Defaults',
      labelField: 'Name',
      labelPlaceholder: 'Continue',
      textField: 'Text to send',
      textPlaceholder: 'The message this button sends\u2026',
      sizeField: 'Size',
      opacityField: 'Opacity',
      shapeField: 'Shape',
      shapeSharp: 'Square',
      shapeSoft: 'Rounded',
      shapePill: 'Pill',
      shapeCircle: 'Circle',
      moveUp: 'Move earlier',
      moveDown: 'Move later',
      remove: 'Delete',
      sendNow: 'Send now',
      sendFailed: 'Quick send failed: {message}',
      sent: 'Sent: {label}',
      emptyText: 'this shortcut has no text yet',
      sessionGone: 'this conversation is not open',
      editorTitle: 'Quick send',
      editorIntro: 'Click a button to send it. Right-click the group to move it.',
      moveHint: 'Drag left or right, then release \u2014 Esc cancels',
      placedLeft: 'Moved to the left of the context meter',
      placedRight: 'Moved to the right of the context meter',
    };
    const zh = {
      trigger: '快捷发送指令',
      close: '关闭',
      empty: '还没有快捷指令 \u2014 点 \u2699 添加',
      add: '添加',
      reset: '默认',
      labelField: '名称',
      labelPlaceholder: '继续',
      textField: '发送文字',
      textPlaceholder: '此按钮发送的消息内容\u2026\u2026',
      sizeField: '大小',
      opacityField: '透明度',
      shapeField: '形状',
      shapeSharp: '方形',
      shapeSoft: '圆角',
      shapePill: '胶囊',
      shapeCircle: '圆形',
      moveUp: '前移',
      moveDown: '后移',
      remove: '删除',
      sendNow: '立即发送',
      sendFailed: '快捷发送失败：{message}',
      sent: '已发送：{label}',
      emptyText: '此快捷指令还没有填写文字',
      sessionGone: '当前对话尚未打开',
      editorTitle: '快捷发送',
      editorIntro: '点击按钮即可直接发送；右键按钮组可拖动换位置。',
      moveHint: '左右拖动后松开 \u2014 按 Esc 取消',
      placedLeft: '已移到上下文进度左侧',
      placedRight: '已移到上下文进度右侧',
    };

    /* ----------------------------------------------------------------- state */

    const SHAPES = ['sharp', 'soft', 'pill', 'circle'];
    const SHAPE_RADIUS = { sharp: 4, soft: 10, pill: 999, circle: '50%' };
    const SIZE_OPTIONS = [11, 12, 13, 14, 16, 18, 20, 22];
    const OPACITY_OPTIONS = [0.3, 0.5, 0.7, 0.85, 1];

    let shortcutIdSeed = 0;
    function nextId() {
      shortcutIdSeed += 1;
      return 'qs-' + Date.now().toString(36) + '-' + shortcutIdSeed;
    }

    function clamp(value, min, max, fallback) {
      if (!Number.isFinite(value)) return fallback;
      if (value < min) return min;
      if (value > max) return max;
      return value;
    }

    /** One shortcut with every field defaulted, clamped, and type-safe. */
    function normalizeShortcut(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const label = typeof source.label === 'string' ? source.label : '';
      const text = typeof source.text === 'string' ? source.text : '';
      const shape = SHAPES.indexOf(source.shape) === -1 ? 'soft' : source.shape;
      return {
        id: typeof source.id === 'string' && source.id !== '' ? source.id : nextId(),
        label: label === '' ? 'Quick' : label,
        text,
        size: clamp(Number(source.size), 10, 22, 13),
        opacity: clamp(Number(source.opacity), 0.2, 1, 1),
        shape,
      };
    }

    function defaultShortcuts() {
      return [
        normalizeShortcut({ label: '\u7ee7\u7eed', text: '\u7ee7\u7eed', size: 13, opacity: 1, shape: 'soft' }),
        normalizeShortcut({ label: '\u603b\u7ed3', text: '\u8bf7\u603b\u7ed3\u5f53\u524d\u8fdb\u5c55\u3002', size: 13, opacity: 1, shape: 'soft' }),
      ];
    }

    function readStored() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed.map(normalizeShortcut);
      } catch (error) {
        return null;
      }
    }

    /* -------------------------------------------------------- shortcut store */

    /**
     * One store shared by the dock and the editor, so an edit is visible at once
     * in the bar and after switching conversations. State is plain JSON.
     */
    const store = (function createStore() {
      let current = readStored() ?? defaultShortcuts();
      const listeners = new Set();

      function emit() {
        for (const listener of Array.from(listeners)) listener();
      }
      function persist() {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch (error) {
          /* Quota exhausted or storage blocked: keep the in-memory value. */
        }
      }
      return {
        getSnapshot() {
          return current;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        replace(next) {
          current = next.map(normalizeShortcut);
          persist();
          emit();
        },
        mutate(change) {
          this.replace(change(current.slice()));
        },
        reset() {
          current = defaultShortcuts();
          persist();
          emit();
        },
      };
    })();

    function useShortcuts() {
      return useSyncExternalStore(store.subscribe, store.getSnapshot);
    }

    /* ------------------------------------------------------- placement store */

    /**
     * Which side of the host's context meter the group sits on. `order: 0`
     * keeps it left of that sibling; `order: 1` moves it right.
     */
    const placementStore = (function createPlacement() {
      let value = 'right';
      try {
        if (window.localStorage.getItem(PLACEMENT_KEY) === 'left') value = 'left';
      } catch (error) {
        /* storage blocked: keep the default */
      }
      const listeners = new Set();
      return {
        getSnapshot() {
          return value;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(next) {
          const normalized = next === 'left' ? 'left' : 'right';
          if (normalized === value) return;
          value = normalized;
          try {
            window.localStorage.setItem(PLACEMENT_KEY, normalized);
          } catch (error) {
            /* keep the in-memory value */
          }
          for (const listener of Array.from(listeners)) listener();
        },
      };
    })();

    function usePlacement() {
      return useSyncExternalStore(placementStore.subscribe, placementStore.getSnapshot);
    }

    /* ----------------------------------------------- editor-open UI state */

    /**
     * Which Session the editor targets and which element it should hang from.
     * The gear lives in the composer dock while the panel renders in the
     * frame-wide `shell.overlay`, so this small store links them. It holds a DOM
     * node by design and is never persisted.
     */
    const ui = (function createUi() {
      let current = { open: false, sessionId: undefined, anchor: null };
      const listeners = new Set();
      function emit() {
        for (const listener of Array.from(listeners)) listener();
      }
      return {
        getSnapshot() {
          return current;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        toggle(sessionId, anchor) {
          current = current.open && current.sessionId === sessionId
            ? { open: false, sessionId: undefined, anchor: null }
            : { open: true, sessionId, anchor };
          emit();
        },
        close() {
          if (!current.open) return;
          current = { open: false, sessionId: undefined, anchor: null };
          emit();
        },
      };
    })();

    function useUi() {
      return useSyncExternalStore(ui.subscribe, ui.getSnapshot);
    }

    /* ------------------------------------------------------------- send action */

    /**
     * Admit one text prompt into the addressed Session in queue mode, matching
     * the composer's own submission path minus the draft echo and attachments.
     */
    async function sendText(sessions, sessionId, text) {
      const binding = sessions.binding(sessionId);
      if (binding === undefined) return { ok: false, message: 'session-unavailable' };
      try {
        const result = await binding.session.prompt([{ type: 'text', text }], 'queue');
        if (!result.ok) {
          const failure = result.error;
          return {
            ok: false,
            message: failure === undefined ? 'unknown' : String(failure.message ?? failure.code),
          };
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    }

    /** Button geometry for one shortcut: a circle gets a real square footprint. */
    function chipStyle(shortcut) {
      const base = { fontSize: shortcut.size + 'px', opacity: shortcut.opacity };
      if (shortcut.shape === 'circle') {
        const diameter = Math.max(30, Math.round(shortcut.size * 2.4));
        return Object.assign(base, {
          width: diameter + 'px',
          height: diameter + 'px',
          padding: '0',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
        });
      }
      return Object.assign(base, { borderRadius: SHAPE_RADIUS[shortcut.shape] });
    }

    /** Options for a numeric select, keeping an off-list current value visible. */
    function optionsFor(options, current) {
      const list = options.slice();
      if (list.indexOf(current) === -1) list.push(current);
      return list.sort((a, b) => a - b);
    }

    /* ------------------------------------------------------------------ styles */

    const css = [
      /* ---- the group: chips + gear, inline in the composer dock row ---- */
      '.qs-group{display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;min-width:0;max-width:100%;position:relative;border-radius:var(--dsw-radius-md);padding:1px 2px;transition:box-shadow .12s,background .12s}',
      /* The dock is a centered flex row whose other child is the host context
       * meter. `order` chooses the side; `margin-left:auto` pushes the group to
       * the far right of the row when it sits right of the meter, so the two
       * are adjacent instead of floating in the middle. */
      '.qs-group[data-place="left"]{order:0}',
      '.qs-group[data-place="right"]{order:1;margin-left:auto}',
      '.qs-group[data-moving="true"]{cursor:grab;box-shadow:0 0 0 1px var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover);touch-action:none;user-select:none}',
      '.qs-group[data-dragging="true"]{cursor:grabbing;opacity:.85}',
      '.qs-chip{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;padding:3px 9px;line-height:18px;font-family:inherit;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;transition:background .12s,border-color .12s}',
      '.qs-chip:hover{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}',
      '.qs-chip:disabled{opacity:.45;cursor:default}',
      '.qs-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.qs-group[data-moving="true"] .qs-chip{cursor:grab;pointer-events:none}',
      '.qs-gear{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);cursor:pointer;font-family:inherit;font-size:12px;line-height:1;transition:background .12s,color .12s}',
      '.qs-gear:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.qs-gear:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.qs-gear[aria-expanded="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}',
      '.qs-group[data-moving="true"] .qs-gear{pointer-events:none;opacity:.5}',
      '.qs-empty{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.qs-hint{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;line-height:16px;padding:3px 8px;border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-soft,0 4px 18px rgba(0,0,0,.18));color:var(--dsw-alias-label-secondary);pointer-events:none;z-index:2}',
      '.qs-toast{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);max-width:260px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-overlay);box-shadow:var(--dsw-elevation-soft,0 4px 18px rgba(0,0,0,.18));padding:3px 8px;font-size:11px;line-height:16px;text-align:center;white-space:nowrap;pointer-events:none;z-index:3}',
      '.qs-toast-ok{color:var(--dsw-alias-label-secondary)}',
      '.qs-toast-err{color:var(--dsw-alias-state-error-primary)}',
      /* ---- floating editor panel, rendered in shell.overlay ---- */
      '.qs-panel{position:fixed;box-sizing:border-box;width:min(330px,90vw);max-height:min(52vh,420px);overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-panel,12px);background:var(--dsw-alias-bg-overlay);box-shadow:var(--dsw-elevation-soft,0 8px 28px rgba(0,0,0,.22));padding:8px;display:flex;flex-direction:column;gap:6px;z-index:60}',
      '.qs-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.qs-panel-title{font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0}',
      '.qs-panel-intro{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);margin:0}',
      '.qs-mini{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font-family:inherit;font-size:11px;line-height:16px;padding:2px 6px}',
      '.qs-mini:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.qs-mini:disabled{opacity:.4;cursor:default}',
      '.qs-mini-danger{color:var(--dsw-alias-state-error-primary)}',
      '.qs-mini-primary{border-color:var(--dsw-alias-brand-primary)}',
      '.qs-card{display:flex;flex-direction:column;gap:5px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:6px}',
      '.qs-card:first-of-type{border-top:none;padding-top:0}',
      '.qs-line{display:flex;align-items:center;gap:5px;min-width:0}',
      '.qs-grow{flex:1;min-width:0}',
      '.qs-input,.qs-textarea,.qs-select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:18px;padding:3px 6px;min-width:0}',
      '.qs-textarea{min-height:42px;max-height:110px;resize:vertical}',
      '.qs-select{cursor:pointer}',
      '.qs-input:focus,.qs-textarea:focus,.qs-select:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}',
      '.qs-empty-panel{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);margin:0}',
    ].join('\n');

    /* ---------------------------------------------- dock: chips + gear group */

    function QuickSendGroup(props) {
      const { sessions, sessionId, t } = props;
      const shortcuts = useShortcuts();
      const placement = usePlacement();
      const state = useUi();

      const [busy, setBusy] = useState(false);
      const [moving, setMoving] = useState(false);
      const [dragging, setDragging] = useState(false);
      const [dragDx, setDragDx] = useState(0);
      const [notice, setNotice] = useState(null);

      const groupRef = useRef(null);
      const gearRef = useRef(null);
      const dragRef = useRef({ active: false, startX: 0, dx: 0, pointerId: null });
      const noticeTimer = useRef(null);

      const open = state.open && state.sessionId === sessionId;

      /* Leaving this seat (Session switch or unmount) closes the panel, so a
       * stale editor never targets the previous conversation. */
      useEffect(() => {
        ui.close();
        return () => ui.close();
      }, [sessionId]);

      useEffect(() => () => {
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      }, []);

      const flash = useCallback((next) => {
        setNotice(next);
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => {
          noticeTimer.current = null;
          setNotice(null);
        }, 2600);
      }, []);

      /* The panel host reports outcomes back through this bridge slot. */
      useEffect(() => {
        panelBridge.report = flash;
        return () => {
          if (panelBridge.report === flash) panelBridge.report = null;
        };
      }, [flash]);

      const onSend = useCallback((shortcut) => {
        if (busy || moving) return;
        if (String(shortcut.text).trim() === '') {
          flash({ kind: 'err', text: t('sendFailed', { message: t('emptyText') }) });
          return;
        }
        setBusy(true);
        sendText(sessions, sessionId, shortcut.text).then((outcome) => {
          setBusy(false);
          if (outcome.ok) flash({ kind: 'ok', text: t('sent', { label: shortcut.label }) });
          else {
            flash({
              kind: 'err',
              text: t('sendFailed', {
                message: outcome.message === 'session-unavailable' ? t('sessionGone') : outcome.message,
              }),
            });
          }
        });
      }, [busy, flash, moving, sessions, sessionId, t]);

      /* Right-click toggles move mode; the browser menu is suppressed. */
      const onContextMenu = useCallback((event) => {
        event.preventDefault();
        setMoving((value) => !value);
        setDragDx(0);
      }, []);

      const onPointerDown = useCallback((event) => {
        if (!moving || event.button !== 0) return;
        event.preventDefault();
        const element = groupRef.current;
        if (element === null) return;
        try {
          element.setPointerCapture(event.pointerId);
        } catch (error) {
          /* capture unsupported: window listeners still deliver moves */
        }
        dragRef.current = { active: true, startX: event.clientX, dx: 0, pointerId: event.pointerId };
        setDragging(true);
        setDragDx(0);
      }, [moving]);

      const onPointerMove = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag.active) return;
        const dx = event.clientX - drag.startX;
        drag.dx = dx;
        setDragDx(dx);
      }, []);

      const finishDrag = useCallback((pointerId) => {
        const drag = dragRef.current;
        if (!drag.active) return;
        drag.active = false;
        const element = groupRef.current;
        if (element !== null && pointerId !== null) {
          try {
            if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
          } catch (error) {
            /* capture already released */
          }
        }
        const dx = drag.dx;
        dragRef.current = { active: false, startX: 0, dx: 0, pointerId: null };
        setDragging(false);
        setDragDx(0);
        setMoving(false);
        if (Math.abs(dx) < 20) return;
        const next = dx < 0 ? 'left' : 'right';
        placementStore.set(next);
        flash({ kind: 'ok', text: next === 'left' ? t('placedLeft') : t('placedRight') });
      }, [flash, t]);

      const onPointerUp = useCallback((event) => {
        finishDrag(event.pointerId);
      }, [finishDrag]);

      /* Escape leaves move mode without moving. */
      useEffect(() => {
        if (!moving) return undefined;
        const onKey = (event) => {
          if (event.key === 'Escape') {
            dragRef.current = { active: false, startX: 0, dx: 0, pointerId: null };
            setDragging(false);
            setDragDx(0);
            setMoving(false);
          }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [moving]);

      const chips = shortcuts.map((shortcut) => h('button', {
        key: shortcut.id,
        type: 'button',
        className: 'qs-chip',
        disabled: busy,
        title: shortcut.text,
        'aria-label': shortcut.label,
        style: chipStyle(shortcut),
        onClick: () => { onSend(shortcut); },
      }, shortcut.label));

      const dragStyle = dragDx === 0 ? undefined : { transform: 'translateX(' + dragDx + 'px)' };

      return h('div', {
        ref: groupRef,
        className: 'qs-group',
        'data-place': placement,
        'data-moving': moving ? 'true' : 'false',
        'data-dragging': dragging ? 'true' : 'false',
        style: dragStyle,
        role: 'group',
        'aria-label': t('trigger'),
        onContextMenu,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
      },
        h('style', { 'data-quick-send': 'styles' }, css),
        shortcuts.length === 0 ? h('span', { className: 'qs-empty' }, t('empty')) : chips,
        h('button', {
          ref: gearRef,
          type: 'button',
          className: 'qs-gear',
          title: t('trigger'),
          'aria-label': t('trigger'),
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          onClick: () => ui.toggle(sessionId, gearRef.current),
        }, open ? '\u2715' : '\u2699'),
        moving ? h('div', { className: 'qs-hint' }, t('moveHint')) : null,
        notice === null ? null : h('div', {
          className: 'qs-toast ' + (notice.kind === 'ok' ? 'qs-toast-ok' : 'qs-toast-err'),
          role: 'status',
        }, notice.text),
      );
    }

    /** Channel from the shell-overlay panel back to the group's status line. */
    const panelBridge = { report: null };

    /* --------------------------------------- panel host in the frame overlay */

    function QuickSendPanelHost(props) {
      const { sessions, t } = props;
      const state = useUi();
      const panelRef = useRef(null);
      const [box, setBox] = useState(null);

      /* Follow the gear's own rect while open: a rAF loop only sets state on an
       * actual change, so an idle panel costs nothing. */
      useEffect(() => {
        if (!state.open || state.anchor === null) {
          setBox(null);
          return undefined;
        }
        let frame = 0;
        let last = null;
        const follow = () => {
          frame = window.requestAnimationFrame(follow);
          const anchor = state.anchor;
          if (anchor === null || !anchor.isConnected) return;
          const rect = anchor.getBoundingClientRect();
          const key = rect.top + ':' + rect.right + ':' + rect.bottom + ':' + rect.left;
          if (key === last) return;
          last = key;
          setBox({ top: rect.bottom + 6, right: rect.right, bottom: rect.top - 6, left: rect.left });
        };
        frame = window.requestAnimationFrame(follow);
        return () => window.cancelAnimationFrame(frame);
      }, [state.open, state.anchor]);

      /* Escape and outside-press dismissal; both listeners die with the panel. */
      useEffect(() => {
        if (!state.open) return undefined;
        const onKey = (event) => {
          if (event.key === 'Escape') ui.close();
        };
        const onPointer = (event) => {
          const panel = panelRef.current;
          const anchor = state.anchor;
          const target = event.target;
          if (panel !== null && panel.contains(target)) return;
          if (anchor !== null && anchor.contains(target)) return;
          ui.close();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer, true);
        return () => {
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('pointerdown', onPointer, true);
        };
      }, [state.open, state.anchor]);

      if (!state.open || box === null || state.sessionId === undefined) return null;

      /* The dock sits low on screen, so prefer opening upward. */
      const viewportH = window.innerHeight;
      const estimated = 380;
      const noRoomBelow = box.top + estimated > viewportH - 8;
      const style = noRoomBelow
        ? { bottom: Math.max(8, viewportH - box.bottom), right: Math.max(8, window.innerWidth - box.right) }
        : { top: Math.max(8, box.top), right: Math.max(8, window.innerWidth - box.right) };

      return h(React.Fragment, null,
        h('style', { 'data-quick-send': 'styles-panel' }, css),
        h(QuickSendEditor, {
          ref: panelRef,
          t,
          sessions,
          sessionId: state.sessionId,
          style,
          onClose: () => ui.close(),
        }));
    }

    /* ------------------------------------------------------------- the editor */

    const QuickSendEditor = React.forwardRef(function QuickSendEditor(props, ref) {
      const { t, sessions, sessionId, style } = props;
      const shortcuts = useShortcuts();

      const report = useCallback((next) => {
        if (panelBridge.report !== null) panelBridge.report(next);
      }, []);

      const update = useCallback((id, patch) => {
        store.mutate((list) => list.map((item) => (
          item.id === id ? normalizeShortcut(Object.assign({}, item, patch)) : item
        )));
      }, []);
      const move = useCallback((index, delta) => {
        store.mutate((list) => {
          const target = index + delta;
          if (target < 0 || target >= list.length) return list;
          const next = list.slice();
          const moved = next.splice(index, 1)[0];
          next.splice(target, 0, moved);
          return next;
        });
      }, []);
      const remove = useCallback((id) => {
        store.mutate((list) => list.filter((item) => item.id !== id));
      }, []);
      const add = useCallback(() => {
        store.mutate((list) => list.concat([normalizeShortcut({ label: '', text: '' })]));
      }, []);
      const send = useCallback((shortcut) => {
        if (String(shortcut.text).trim() === '') {
          report({ kind: 'err', text: t('sendFailed', { message: t('emptyText') }) });
          return;
        }
        sendText(sessions, sessionId, shortcut.text).then((outcome) => {
          if (outcome.ok) report({ kind: 'ok', text: t('sent', { label: shortcut.label }) });
          else {
            report({
              kind: 'err',
              text: t('sendFailed', {
                message: outcome.message === 'session-unavailable' ? t('sessionGone') : outcome.message,
              }),
            });
          }
        });
      }, [report, sessions, sessionId, t]);

      return h('div', {
        ref,
        className: 'qs-panel',
        role: 'dialog',
        'aria-label': t('editorTitle'),
        style,
      },
        h('div', { className: 'qs-panel-head' },
          h('h4', { className: 'qs-panel-title' }, t('editorTitle')),
          h('div', { className: 'qs-line' },
            h('button', { type: 'button', className: 'qs-mini qs-mini-primary', onClick: add }, t('add')),
            h('button', { type: 'button', className: 'qs-mini', onClick: () => store.reset() }, t('reset')),
            h('button', {
              type: 'button', className: 'qs-mini',
              title: t('close'), 'aria-label': t('close'),
              onClick: () => props.onClose(),
            }, '\u2715'),
          ),
        ),
        h('p', { className: 'qs-panel-intro' }, t('editorIntro')),
        shortcuts.length === 0 ? h('p', { className: 'qs-empty-panel' }, t('empty')) : null,
        shortcuts.map((shortcut, index) => h(ShortcutCard, {
          key: shortcut.id,
          shortcut,
          index,
          total: shortcuts.length,
          t,
          onChange: update,
          onMove: move,
          onRemove: remove,
          onSend: send,
        })),
      );
    });

    function ShortcutCard(props) {
      const { shortcut, index, total, t } = props;
      const set = useCallback((patch) => props.onChange(shortcut.id, patch), [props, shortcut.id]);

      const sizeOptions = optionsFor(SIZE_OPTIONS, shortcut.size);
      const opacityOptions = optionsFor(OPACITY_OPTIONS, shortcut.opacity);

      return h('div', { className: 'qs-card' },
        /* name, send-now, reorder, delete */
        h('div', { className: 'qs-line' },
          h('input', {
            className: 'qs-input qs-grow',
            type: 'text',
            value: shortcut.label,
            placeholder: t('labelPlaceholder'),
            'aria-label': t('labelField'),
            onChange: (event) => set({ label: event.target.value }),
          }),
          h('button', {
            type: 'button',
            className: 'qs-mini',
            title: t('sendNow'),
            'aria-label': t('sendNow'),
            onClick: () => props.onSend(shortcut),
          }, '\u25b6'),
          h('button', {
            type: 'button', className: 'qs-mini', disabled: index === 0,
            title: t('moveUp'), 'aria-label': t('moveUp'),
            onClick: () => props.onMove(index, -1),
          }, '\u2191'),
          h('button', {
            type: 'button', className: 'qs-mini', disabled: index === total - 1,
            title: t('moveDown'), 'aria-label': t('moveDown'),
            onClick: () => props.onMove(index, 1),
          }, '\u2193'),
          h('button', {
            type: 'button', className: 'qs-mini qs-mini-danger',
            title: t('remove'), 'aria-label': t('remove'),
            onClick: () => props.onRemove(shortcut.id),
          }, '\u2715'),
        ),
        h('textarea', {
          className: 'qs-textarea',
          value: shortcut.text,
          placeholder: t('textPlaceholder'),
          'aria-label': t('textField'),
          onChange: (event) => set({ text: event.target.value }),
        }),
        /* size + opacity + shape on one compact line */
        h('div', { className: 'qs-line' },
          h('select', {
            className: 'qs-select', value: String(shortcut.size),
            title: t('sizeField'), 'aria-label': t('sizeField'),
            onChange: (event) => set({ size: Number(event.target.value) }),
          }, sizeOptions.map((value) => h('option', { key: value, value: String(value) }, value + 'px'))),
          h('select', {
            className: 'qs-select', value: String(shortcut.opacity),
            title: t('opacityField'), 'aria-label': t('opacityField'),
            onChange: (event) => set({ opacity: Number(event.target.value) }),
          }, opacityOptions.map((value) => h('option', { key: value, value: String(value) }, Math.round(value * 100) + '%'))),
          h('select', {
            className: 'qs-select', value: shortcut.shape,
            title: t('shapeField'), 'aria-label': t('shapeField'),
            onChange: (event) => set({ shape: event.target.value }),
          },
            h('option', { value: 'sharp' }, t('shapeSharp')),
            h('option', { value: 'soft' }, t('shapeSoft')),
            h('option', { value: 'pill' }, t('shapePill')),
            h('option', { value: 'circle' }, t('shapeCircle')),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------ seat shells */

    function DockSeat(props) {
      const sessionId = props.sessionId;
      if (sessionId === undefined) return null;
      return h(QuickSendGroup, { sessions: props.sessions, sessionId, t: props.t });
    }

    /* ------------------------------------------------------------------- apply */

    return {
      inject: ['slots', 'locale', 'sessions'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'quick-send: dictionaries');
        const sessions = ctx.sessions;

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'quick-send-dock',
          order: 40,
          locale: NS,
          inject: () => ({ sessions }),
        }, DockSeat));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'quick-send-panel',
          order: 60,
          locale: NS,
          inject: () => ({ sessions }),
        }, function PanelSeat(props) {
          return h(QuickSendPanelHost, { sessions: props.sessions, t: props.t });
        }));
      },
    };
  },
});
