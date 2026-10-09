import {
	clamp01,
	OVERLAY_EASE,
} from "../../../../.eliza/client-features/packages/ui/src/components/shell/chat-overlay-motion.ts";
import {
	resolveChatPanelLayout,
} from "../../../../.eliza/client-features/packages/ui/src/components/shell/chat-panel-layout.ts";

type Shell = any;
type Mode = "hidden" | "sheet" | "full";
type Drag = {
	id: number;
	owner: HTMLElement;
	mode: Mode;
	view: unknown;
	screen: unknown;
	y: number;
	lastY: number;
	lastAt: number;
	velocity: number;
	scale: number;
	start: number;
	height: number;
	full: number;
	half: number;
	moved: boolean;
};
/** Product gesture binding over shared pure geometry; never owns transcript/input gestures. */
export function installChatOverlayMotion(Component: Shell) {
	const p = Component.prototype,
		render = p.renderVals,
		mount = p.componentDidMount,
		update = p.componentDidUpdate,
		unmount = p.componentWillUnmount;
	function bounds() {
		const screen = document.querySelector<HTMLElement>("[data-screen]");
		const viewportH = screen?.clientHeight || window.innerHeight;
		// Shared layout supplies the viewport ceiling; retain its 200px short-panel preference.
		const full = resolveChatPanelLayout({
			viewportH,
			bottomPad: 0,
			keyboardInset: 0,
			effectiveKeyboardInset: 0,
			safeAreaTopPx: 0,
			fullBleed: true,
		}).panelMaxH;
		const inset = resolveChatPanelLayout({
			viewportH,
			bottomPad: 0,
			keyboardInset: 0,
			effectiveKeyboardInset: 0,
			safeAreaTopPx: 0,
			fullBleed: false,
		}).panelMaxH;
		return {
			full,
			half: Math.min(
				inset,
				Math.max(200, Math.round(viewportH * 0.6)),
			),
			scale: screen ? screen.getBoundingClientRect().height / viewportH : 1,
		};
	}
	function retire(shell: Shell, redraw = true) {
		const drag: Drag | undefined = shell.chatMotion;
		shell.chatMotion = undefined;
		if (!drag) return;
		if (drag.moved) shell.swallow = Date.now();
		if (drag.owner.hasPointerCapture(drag.id))
			drag.owner.releasePointerCapture(drag.id);
		if (redraw && shell.live !== false) shell.setState({});
	}
	p.componentDidMount = function () {
		mount?.call(this);
		this.cancelChatMotion = () => retire(this);
		this.chatMotionVisibility = () => {
			if (document.hidden) retire(this);
		};
		window.addEventListener("resize", this.cancelChatMotion);
		window.addEventListener("blur", this.cancelChatMotion);
		window.addEventListener("pagehide", this.cancelChatMotion);
		document.addEventListener("visibilitychange", this.chatMotionVisibility);
	};
	p.componentDidUpdate = function (previous: Shell) {
		update?.call(this, previous);
		const drag: Drag | undefined = this.chatMotion,
			s = this.S();
		if (
			drag &&
			(s.view !== drag.view ||
				s.screen !== drag.screen ||
				s.chat !== drag.mode ||
				s.voice !== "off")
		)
			retire(this);
	};
	p.componentWillUnmount = function () {
		retire(this, false);
		window.removeEventListener("resize", this.cancelChatMotion);
		window.removeEventListener("blur", this.cancelChatMotion);
		window.removeEventListener("pagehide", this.cancelChatMotion);
		document.removeEventListener("visibilitychange", this.chatMotionVisibility);
		unmount?.call(this);
	};
	p.renderVals = function () {
		const out = render.call(this),
			shell = this,
			s = this.S(),
			geometry = bounds(),
			drag: Drag | undefined = this.chatMotion;
		out.panelH =
			drag?.height ??
			(s.chat === "full"
				? geometry.full
				: s.chat === "sheet"
					? geometry.half
					: 0);
		out.panelTransition = drag?.moved
			? "none"
			: `height .42s cubic-bezier(${OVERLAY_EASE.join(",")}), border-radius .42s, opacity .2s`;
		out.pillDragStyle = drag?.moved
			? `opacity:${1 - clamp01(drag.height / Math.max(1, drag.half))}`
			: "";
		if (drag?.moved) {
			out.conversationHidden = false;
			out.panelComposer = true;
			out.panelOp = 1;
			out.panelPE = "auto";
			out.panelR = drag.height >= drag.full ? "0px" : "30px 30px 0 0";
		}
		const handlers = {
			down(event: PointerEvent) {
				if (
					shell.chatMotion ||
					event.isPrimary === false ||
					event.button !== 0 ||
					!["hidden", "sheet", "full"].includes(shell.S().chat)
				)
					return;
				event.stopPropagation();
				const g = bounds(),
					mode = shell.S().chat as Mode,
					target =
						event.target instanceof Element
							? event.target.closest("button")
							: null,
					owner =
						target instanceof HTMLElement &&
						event.currentTarget instanceof HTMLElement &&
						event.currentTarget.contains(target)
							? target
							: (event.currentTarget as HTMLElement);
				owner.setPointerCapture(event.pointerId);
				shell.swallow = 0;
				shell.chatMotion = {
					id: event.pointerId,
					owner,
					mode,
					view: shell.S().view,
					screen: shell.S().screen,
					y: event.clientY,
					lastY: event.clientY,
					lastAt: event.timeStamp,
					velocity: 0,
					scale: g.scale || 1,
					start:
						mode === "full"
							? g.full
							: mode === "sheet"
								? g.half
								: Math.min(80, g.half),
					height: mode === "full" ? g.full : mode === "sheet" ? g.half : 0,
					full: g.full,
					half: g.half,
					moved: false,
				} satisfies Drag;
			},
			move(event: PointerEvent) {
				const d: Drag | undefined = shell.chatMotion;
				if (!d || event.pointerId !== d.id) return;
				event.stopPropagation();
				const delta = (event.clientY - d.y) / d.scale;
				if (!d.moved && Math.abs(delta) < 8) return;
				event.preventDefault();
				const firstMove = !d.moved;
				d.moved = true;
				const dt = event.timeStamp - d.lastAt;
				if (dt > 0) d.velocity = (event.clientY - d.lastY) / d.scale / dt;
				d.lastY = event.clientY;
				d.lastAt = event.timeStamp;
				d.height = clamp01((d.start - delta) / Math.max(1, d.full)) * d.full;
				// Paint subsequent pointer positions directly: rebuilding the entire app
				// per movement would put React work between the finger and the sheet.
				const panel = document.querySelector<HTMLElement>(
					'[data-alpha-layer="conversation"]',
				);
				if (panel) {
					panel.style.transition = "none";
					panel.style.height = `${d.height}px`;
				}
				const pill = document.querySelector<HTMLElement>(
					'[data-alpha-layer="pill"]>div',
				);
				if (pill)
					pill.style.opacity = String(
						1 - clamp01(d.height / Math.max(1, d.half)),
					);
				if (firstMove) shell.setState({});
			},
			up(event: PointerEvent) {
				const d: Drag | undefined = shell.chatMotion;
				if (!d || event.pointerId !== d.id) return;
				event.stopPropagation();
				if (event.clientY !== d.lastY) handlers.move(event);
				if (event.timeStamp - d.lastAt > 120) d.velocity = 0;
				const delta = (event.clientY - d.y) / d.scale,
					deliberate =
						d.moved && (Math.abs(delta) >= 40 || Math.abs(d.velocity) >= 0.6);
				let next = d.mode;
				if (deliberate) {
					if (delta < 0)
						next =
							d.mode === "sheet" || d.height > (d.half + d.full) / 2
								? "full"
								: "sheet";
					else
						next =
							d.mode === "full" &&
							d.height > d.half / 2 &&
							!(delta > d.half && d.velocity > 0.6)
								? "sheet"
								: "hidden";
				}
				retire(shell, false);
				if (d.moved) {
					event.preventDefault();
					shell.swallow = Date.now();
					shell.setState({ chat: next });
				}
			},
			cancel(event: PointerEvent) {
				if (shell.chatMotion?.id === event.pointerId) retire(shell);
			},
		};
		out.grabSw = handlers;
		out.pillSw = handlers;
		// A captured drag may end over a former pill button. It must not synthesize
		// a second action (including Type/Talk) after committing its detent.
		for (const name of ["openSheet", "toInput", "startVoice"]) {
			const action = out[name];
			out[name] = (...args: unknown[]) => {
				if (!shell.swallowed()) return action?.(...args);
			};
		}
		const grabTap = out.grabTap;
		out.grabTap = (event: MouseEvent) => {
			if (event.detail === 0) {
				retire(shell, false);
				shell.setState({ chat: shell.S().chat === "full" ? "sheet" : "full" });
			} else grabTap(event);
		};
		out.closeChat = () => {
			retire(shell, false);
			shell.setState({ chat: "hidden" });
		};
		out.scrimTap = out.closeChat;
		return out;
	};
}
