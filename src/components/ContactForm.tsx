import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import type { ContactFormValues, FormStatus } from "@/types";
import { validateContactForm, type ContactFormErrors } from "@/utils/validateContactForm";
import { submitContactForm } from "@/utils/contactService";
import { siteConfig } from "@/data/site";
import { cn } from "@/utils/cn";
import { Magnetic } from "@/components/Magnetic";
import { ease, jiggle, press, spring } from "@/utils/motion";
import { useTypeOnce } from "@/hooks/useTypeOnce";
import { useTypingPreview } from "@/hooks/useTypingPreview";

const initialValues: ContactFormValues = { name: "", email: "", message: "" };

/**
 * The send sequence, as one continuous event rather than four animations
 * played back to back. Every stage below is driven from a single
 * `runDelivery` chain, so nothing starts before the stage before it has
 * finished, and every stage is reversible: a failed request unwinds the same
 * chain backwards and hands the visitor their letter back intact.
 *
 *   writing   → the letter, editable
 *   sealing   → content settles out, the paper folds down to envelope
 *               proportions, the flap rotates shut, the seal presses on
 *   flying    → the same element arcs away and shrinks into the distance
 *   delivered → it resolves into the confirmation
 *   unsealing → "Write another": the confirmation contracts back into the
 *               sealed envelope, the seal lifts, the flap opens, and the paper
 *               unfolds into a blank letter
 *
 * `unsealing` runs the same three envelope parts through the same three stage
 * lengths in the opposite order, so it is the send read backwards rather than
 * a second animation that happens to look similar.
 *
 * The card is one DOM element throughout. Nothing is swapped for a separate
 * "envelope component" — the paper is the envelope is the confirmation panel,
 * which is what makes the sequence read as one physical object.
 */
type Phase = "writing" | "sealing" | "flying" | "delivered" | "unsealing";

/** Stage lengths in ms. These are the sequence's only clock. */
const STAGE = {
  settle: 260,
  fold: 560,
  flap: 420,
  seal: 300,
  fly: 880,
} as const;

/** Envelope proportions. Width is clamped to the letter's own width at run
 * time, so the folded state can never be wider than the column it lives in. */
const ENVELOPE = { width: 340, height: 208 } as const;

/**
 * The message body's ruled paper. One source for the geometry: `line` is both
 * the gradient's period and the textarea's `line-height`, which is what makes
 * every rule exactly one line apart and puts typed text on the rule rather
 * than between two of them. Kept together here so the two can never drift.
 */
const RULE = { line: 26, offset: 4, rows: 5 } as const;

/** One source for the rule colour. The closing separator below the body is a
 * writing line too and has to match it exactly, so neither may hardcode it. */
const RULE_COLOR = "color-mix(in srgb, var(--fg-faint) 34%, transparent)";

const ruledPaper = `repeating-linear-gradient(to bottom, transparent 0 ${RULE.line - 1}px, ${RULE_COLOR} ${RULE.line - 1}px ${RULE.line}px)`;

/** The body's own vertical padding (`py-1` in `fieldClasses`), in px. */
const FIELD_PAD_Y = 4;

/**
 * Gap from the body's last rule down to the closing separator, so that line
 * continues the same 26px rhythm instead of sitting on its own.
 *
 * Three things sit between the last rule and the separator, and all three have
 * to be subtracted or the gap comes out too large:
 *   1px  — the remainder of the last rule's own period
 *   4px  — the textarea's bottom padding (`FIELD_PAD_Y`)
 *   ~6px — the inline line-box descender under the textarea, removed by
 *          giving it `block` (it is invisible in any inspector, and was the
 *          least obvious part of the original 39.4px gap)
 */
const CLOSING_RULE_GAP = RULE.line - 1 - FIELD_PAD_Y;

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

interface ContactFormProps {
  onFieldFocus?: (field: keyof ContactFormValues | null) => void;
}

export function ContactForm({ onFieldFocus }: ContactFormProps) {
  const [values, setValues] = useState<ContactFormValues>(initialValues);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [phase, setPhase] = useState<Phase>("writing");
  /** Height the wrapper holds while the card is folded or in flight, so the
   * page below never moves during the sequence. */
  const [reservedHeight, setReservedHeight] = useState<number | null>(null);

  const inFlight = useRef(false);
  // Honeypot. Kept in a ref rather than form state so typing into it never
  // re-renders the form; only a bot filling the DOM will ever set it.
  const honeypot = useRef("");
  const cardRef = useRef<HTMLDivElement>(null);
  const card = useAnimationControls();
  const reduceMotion = useReducedMotion();
  // Guards the async chain against a component that unmounted mid-flight.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** 0-3: how much of the letter is actually written. Derived from the same
   * validator the submit path uses, so "complete" here and "valid" there can
   * never disagree. */
  const written = useMemo(() => 3 - Object.keys(validateContactForm(values)).length, [values]);

  function handleChange(field: keyof ContactFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setStatus((prev) => (prev === "success" || prev === "error" ? "idle" : prev));
  }

  /**
   * Folds the letter, waits for the real send, then either flies it away or
   * unfolds it.
   *
   * The request is started before the fold, so the paper is already moving
   * while the network call is in the air and the visitor never watches a
   * frozen form — but "delivered" is reached only once the API has actually
   * succeeded. Whichever of the two finishes last decides when the envelope
   * leaves.
   */
  async function runDelivery(request: Promise<void>) {
    const el = cardRef.current;

    if (!el || reduceMotion) {
      // Reduced motion keeps the plain status-text flow the form always had.
      try {
        await request;
        if (!alive.current) return;
        setStatus("success");
        setValues(initialValues);
        setPhase("delivered");
      } catch {
        if (alive.current) setStatus("error");
      }
      return;
    }

    const height = el.offsetHeight;
    const width = el.offsetWidth;
    const envelopeWidth = Math.min(ENVELOPE.width, width);

    // Pin the card at exactly its current size before animating away from it,
    // so the first frame of the fold is identical to the last frame of the
    // letter and the fold reads as continuous.
    card.set({ height, width });
    setReservedHeight(height);
    setPhase("sealing");

    const folding = (async () => {
      await sleep(STAGE.settle);
      await card.start(
        { height: ENVELOPE.height, width: envelopeWidth },
        { duration: STAGE.fold / 1000, ease: ease.standard },
      );
      // The flap and seal are the Envelope layer's own delayed animations;
      // this just holds the chain open until they have finished.
      await sleep(STAGE.flap + STAGE.seal);
    })();

    const [sent] = await Promise.all([
      request.then(
        () => true,
        () => false,
      ),
      folding,
    ]);

    if (!alive.current) return;

    if (!sent) {
      // Unwind. The flap lifts and the paper opens back out to exactly the
      // size it was, with everything the visitor typed still in it.
      setPhase("writing");
      await card.start({ height, width }, { duration: STAGE.fold / 1000, ease: ease.standard });
      if (!alive.current) return;
      card.set({ height: "auto", width: "auto" });
      setReservedHeight(null);
      setStatus("error");
      return;
    }

    setPhase("flying");
    await card.start({
      x: [0, 18, 96],
      y: [0, 14, -230],
      rotate: [0, 3, -16],
      scale: [1, 1.02, 0.32],
      opacity: [1, 1, 0],
      transition: { duration: STAGE.fly / 1000, ease: [0.5, 0, 0.3, 1], times: [0, 0.18, 1] },
    });
    if (!alive.current) return;

    // The card is handed back to the layout in one instant `set`, with no
    // animation of its own: `Delivered` owns the emergence.
    //
    // It has to be exactly one owner. Springing the card's `scale` here while
    // Framer was still resolving `width`/`height` back to `auto` made the two
    // fight over the same matrix, and the card momentarily measured
    // 21943x12836 — a single frame of the whole page blowing out — before the
    // spring pulled it back.
    card.set({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 0, height: "auto", width: "auto" });
    setStatus("success");
    setValues(initialValues);
    setPhase("delivered");
    setReservedHeight(null);
    // Held at zero across the handoff. Releasing `height` to `auto` while the
    // spent letter is still the only mounted child resolves it to the *letter's*
    // height for a frame or two before `Delivered` takes over and it collapses
    // — measured as a 539px empty card flashing for ~34ms. Fading in after that
    // settles hides it. Opacity only: it takes no part in layout projection, so
    // this cannot bring back the scale race noted above.
    await card.start({ opacity: 1 }, { duration: 0.25, ease: ease.standard });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // A ref, not the `submitting` status: state updates are asynchronous, so
    // two submits landing in the same tick would both read the old status and
    // both send. The disabled button already covers clicks; this covers
    // pressing Enter twice quickly, which the button never sees.
    if (inFlight.current) return;

    const validationErrors = validateContactForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    inFlight.current = true;
    setStatus("submitting");
    try {
      await runDelivery(submitContactForm({ ...values, company: honeypot.current }));
    } finally {
      inFlight.current = false;
    }
  }

  /**
   * The send, run backwards. The confirmation contracts into the sealed
   * envelope it arrived as, the seal lifts, the flap opens and the paper
   * unfolds into a blank letter — one element changing shape the whole way,
   * never a swap between a success panel and a form.
   *
   * The unfold animates `height`/`width` back to `auto` rather than to a
   * measured number: the blank letter's height is not knowable until it has
   * rendered, and Framer measures the target itself.
   */
  async function handleWriteAnother() {
    if (inFlight.current) return;

    const el = cardRef.current;
    setStatus("idle");
    setErrors({});

    if (!el || reduceMotion) {
      setPhase("writing");
      return;
    }

    inFlight.current = true;
    try {
      const height = el.offsetHeight;
      const width = el.offsetWidth;

      card.set({ height, width });
      setReservedHeight(height);
      setPhase("unsealing");

      await sleep(STAGE.settle);
      if (!alive.current) return;
      await card.start(
        { height: ENVELOPE.height, width: Math.min(ENVELOPE.width, width) },
        { duration: STAGE.fold / 1000, ease: ease.standard },
      );

      // The seal lifting and the flap opening are the Envelope layer's own
      // delayed animations; this holds the chain open until they are done.
      await sleep(STAGE.seal + STAGE.flap);
      if (!alive.current) return;

      // The paper opens out and the blank letter fades in with it.
      setPhase("writing");
      await card.start({ height: "auto", width: "auto" }, { duration: STAGE.fold / 1000, ease: ease.standard });
      if (!alive.current) return;
      setReservedHeight(null);
    } finally {
      inFlight.current = false;
    }
  }

  const isSubmitting = status === "submitting";
  const sealed = phase !== "writing";

  return (
    <div style={{ minHeight: reservedHeight ?? undefined }} className="relative">
      <FlightTrail active={phase === "flying"} />

      <motion.div
        ref={cardRef}
        animate={card}
        style={{ perspective: 1000, transformOrigin: "50% 60%" }}
        className={cn(
          "relative overflow-hidden rounded-[26px] border border-border bg-bg-elevated shadow-lg",
          // The paper's margin rule, in a faint accent tint so the sheet reads
          // as written-on in both themes rather than as a plain card.
          "before:pointer-events-none before:absolute before:inset-y-0 before:left-7 before:w-px before:content-['']",
          "before:bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] before:opacity-60",
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, color-mix(in srgb, var(--accent) 6%, transparent), transparent 55%)",
          }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {phase === "delivered" ? (
            <Delivered key="delivered" onWriteAnother={handleWriteAnother} />
          ) : (
            <motion.div
              key="letter"
              animate={{ opacity: sealed ? 0 : 1, y: sealed ? -8 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: STAGE.settle / 1000, ease: ease.standard }}
              aria-hidden={sealed || undefined}
              className={cn("relative px-6 py-7 sm:px-8 sm:py-8", sealed && "pointer-events-none")}
            >
              <form noValidate onSubmit={handleSubmit}>
                {/* Invisible to people and to assistive tech, skipped by tabbing, and
                    never autofilled. Anything in it came from a script filling every
                    field it found, and the endpoint answers those with a silent OK. */}
                <input
                  type="text"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  onChange={(event) => (honeypot.current = event.target.value)}
                  className="pointer-events-none absolute h-0 w-0 opacity-0"
                />

                <div className="flex items-start justify-between gap-4 pl-4">
                  <p className="font-mono text-base text-fg sm:text-lg">Dear Mukul,</p>
                  <Stamp written={written} />
                </div>

                <div className="mt-6 space-y-5">
                  <WrittenLine
                    id="name"
                    lead="My name is"
                    value={values.name}
                    error={errors.name}
                    onChange={(v) => handleChange("name", v)}
                    onFocus={() => onFieldFocus?.("name")}
                    onBlur={() => onFieldFocus?.(null)}
                    autoComplete="name"
                    previewText="John Doe"
                  />
                  <WrittenLine
                    id="email"
                    lead="and you can reach me at"
                    type="email"
                    value={values.email}
                    error={errors.email}
                    onChange={(v) => handleChange("email", v)}
                    onFocus={() => onFieldFocus?.("email")}
                    onBlur={() => onFieldFocus?.(null)}
                    autoComplete="email"
                    previewText="john.doe@example.com"
                  />
                  <WrittenLine
                    id="message"
                    lead="I wanted to say"
                    as="textarea"
                    value={values.message}
                    error={errors.message}
                    onChange={(v) => handleChange("message", v)}
                    onFocus={() => onFieldFocus?.("message")}
                    onBlur={() => onFieldFocus?.(null)}
                    previewText="Tell me about the role or what you're building…"
                  />
                </div>

                {/* The closing separator is the letter's last writing line, so
                    it is drawn to the same spec as the rest rather than as a
                    section divider: same colour and thickness from
                    `RULE_COLOR`, same 26px rhythm via `CLOSING_RULE_GAP`, and
                    `ml-4` rather than `pl-4` — padding sits *inside* the border
                    box, so `pl-4` left the line starting 16px further left than
                    every rule above it while looking correct in the markup. */}
                <div
                  style={{
                    marginTop: CLOSING_RULE_GAP,
                    borderTopWidth: 1,
                    borderTopStyle: "solid",
                    borderTopColor: RULE_COLOR,
                  }}
                  className="flex flex-wrap items-center justify-between gap-4 pt-5 ml-4"
                >
                  <p className="font-mono text-xs text-fg-faint">
                    {written === 3 ? "Ready to send." : "Kind regards,"}
                  </p>

                  <Magnetic>
                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={isSubmitting ? undefined : { y: -2 }}
                      whileTap={isSubmitting ? undefined : press.whileTap}
                      transition={press.transition}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold",
                        "transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-70",
                        // Never actually disabled while the letter is
                        // incomplete: the validation messages are the
                        // feedback, and a button that cannot be pressed can
                        // never produce them. It only *looks* like it inks in
                        // as the letter does.
                        written === 3
                          ? "bg-accent text-accent-fg"
                          : "border border-border-strong bg-transparent text-fg-muted",
                      )}
                    >
                      <SendIcon />
                      {isSubmitting ? "Sending…" : "Seal & Send"}
                    </motion.button>
                  </Magnetic>
                </div>
              </form>

              <div role="status" aria-live="polite" className="mt-4 pl-4 text-sm">
                <AnimatePresence mode="wait">
                  {status === "error" && (
                    <motion.p
                      key="error"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-wrap items-center gap-1.5 text-red-500"
                    >
                      <AlertIcon />
                      The letter came back. Please try again, or{" "}
                      <a href={`mailto:${siteConfig.email}`} className="underline underline-offset-2">
                        email me directly
                      </a>
                      .
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Envelope phase={phase} />
      </motion.div>
    </div>
  );
}

/**
 * The folded state, drawn inside the same card. The flap is a clipped
 * triangle rotating about its top edge, which is what a real flap does; the
 * side folds sweep in beneath it. Transform and opacity only, and it costs
 * nothing while the letter is being written — at `opacity: 0` with no
 * animation running, it never repaints.
 */
function Envelope({ phase }: { phase: Phase }) {
  const sealing = phase === "sealing" || phase === "flying";
  const unsealing = phase === "unsealing";
  const shown = sealing || unsealing;
  const t = (ms: number) => ms / 1000;
  const lead = t(STAGE.settle);

  // Closing runs sides → flap → seal; opening runs seal → flap → sides. The
  // opening targets are two-value keyframes so each part snaps to its sealed
  // state on the first frame and animates out of it: entering `unsealing` from
  // `delivered` finds every part already at rest/open, and animating "to open"
  // from open would be a no-op.
  const sides = unsealing
    ? { to: [1, 0.15], delay: lead + t(STAGE.fold + STAGE.seal), duration: t(STAGE.flap) }
    : { to: shown ? 1 : 0.15, delay: shown ? lead : 0, duration: t(STAGE.fold) };
  const flap = unsealing
    ? { to: [0, -160], delay: lead + t(STAGE.fold + STAGE.seal), duration: t(STAGE.flap) }
    : { to: shown ? 0 : -160, delay: shown ? lead + t(STAGE.fold) : 0, duration: t(STAGE.flap) };
  const seal = unsealing
    ? { to: [1, 0], delay: lead + t(STAGE.fold) }
    : { to: shown ? 1 : 0, delay: shown ? lead + t(STAGE.fold + STAGE.flap) : 0 };

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ perspective: 1000 }}>
      <motion.div
        initial={false}
        animate={{ opacity: shown ? 1 : 0 }}
        // Appearing waits for the content to settle out; on the way back out
        // the envelope is already open, so it just goes.
        transition={{ duration: 0.24, delay: sealing ? lead : 0 }}
        className="absolute inset-0"
      >
        {/* Side folds — the paper's own edges coming inward, and pulling back
            out again as it opens. */}
        {[0, 1].map((side) => (
          <motion.div
            key={side}
            initial={false}
            animate={{ scaleX: sides.to }}
            transition={{ duration: sides.duration, delay: sides.delay, ease: ease.standard }}
            className="absolute inset-y-0 w-1/2 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
            style={{
              left: side === 0 ? 0 : "50%",
              transformOrigin: side === 0 ? "left center" : "right center",
              clipPath: side === 0 ? "polygon(0 0, 100% 50%, 0 100%)" : "polygon(100% 0, 0 50%, 100% 100%)",
            }}
          />
        ))}

        {/* Flap. Rotates shut about its top edge once the fold has landed, and
            lifts about the same edge once the seal is off. */}
        <motion.div
          initial={false}
          animate={{ rotateX: flap.to }}
          transition={{ duration: flap.duration, delay: flap.delay, ease: ease.standard }}
          className="absolute inset-x-0 top-0 h-[58%] bg-bg-subtle"
          style={{
            transformOrigin: "top center",
            transformStyle: "preserve-3d",
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            backfaceVisibility: "hidden",
          }}
        />

        {/* Seal, pressed on once the flap is down and lifted off before it
            opens again. */}
        <motion.div
          initial={false}
          animate={{ scale: seal.to }}
          transition={{ delay: seal.delay, type: "spring", stiffness: 520, damping: 14 }}
          className="absolute top-[58%] left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-bold text-accent-fg shadow-md"
        >
          MN
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Four motes left in the envelope's wake, dissipating behind it. Pure
 * transform and opacity, mounted only for the length of the flight. */
function FlightTrail({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: [0, 0.7, 0], x: 56 + i * 8, y: -110 - i * 32, scale: 0.3 }}
          transition={{ duration: 0.7, delay: 0.12 + i * 0.07, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full bg-accent"
        />
      ))}
    </div>
  );
}

/** The confirmation, emerging as the envelope's own resolution rather than as
 * a toast: the check draws itself, then the line types out. */
function Delivered({ onWriteAnother }: { onWriteAnother: () => void }) {
  const { display } = useTypeOnce("Your letter reached Mukul. I'll get back to you soon.", true);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={spring.soft}
      className="relative flex flex-col items-center gap-4 px-6 py-14 text-center sm:px-8"
    >
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true" className="text-accent">
        <motion.circle
          cx="26"
          cy="26"
          r="24"
          stroke="currentColor"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0.35 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: ease.standard }}
        />
        <motion.path
          d="M16 27l7 7 13-14"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.35, ease: ease.standard }}
        />
      </svg>

      <p className="font-mono text-sm text-fg">Message delivered</p>
      <p role="status" aria-live="polite" className="min-h-[2.5rem] max-w-xs text-sm text-fg-muted">
        {display}
      </p>

      <button
        type="button"
        onClick={onWriteAnother}
        className="mt-1 rounded-full border border-border px-5 py-2 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
      >
        Write another
      </button>
    </motion.div>
  );
}

/** Corner stamp that inks in as the letter is written — the completion cue,
 * and the mark the wax seal echoes when the envelope closes. */
function Stamp({ written }: { written: number }) {
  const complete = written === 3;

  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={{ opacity: 0.32 + written * 0.22, scale: complete ? 1 : 0.94, rotate: complete ? 0 : -4 }}
      transition={spring.soft}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 border-dashed",
        complete ? "border-accent bg-accent-soft text-accent" : "border-border text-fg-faint",
      )}
    >
      <MailGlyph />
    </motion.div>
  );
}

interface WrittenLineProps {
  id: string;
  /** The sentence lead-in. This *is* the field's `<label>` — the letter reads
   * as prose and the control is labelled properly at the same time, rather
   * than a placeholder pretending to be a label. */
  lead: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  type?: string;
  as?: "input" | "textarea";
  autoComplete?: string;
  /** Example text typed out as a ghost preview while the field is empty
   * and hovered/focused — purely illustrative, never touches the real value. */
  previewText?: string;
}

function WrittenLine({
  id,
  lead,
  value,
  error,
  onChange,
  onFocus,
  onBlur,
  type = "text",
  as = "input",
  autoComplete,
  previewText,
}: WrittenLineProps) {
  const errorId = `${id}-error`;
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();
  const hasFocusedRef = useRef(false);
  const prevErrorRef = useRef(error);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const previewActive = Boolean(previewText) && !value && !reduceMotion && (isFocused || isHovered);
  const previewDisplay = useTypingPreview(previewText ?? "", previewActive);

  useEffect(() => {
    if (error && !prevErrorRef.current && !reduceMotion) {
      controls.start({ ...jiggle.shake, transition: jiggle.shakeTransition });
    }
    prevErrorRef.current = error;
  }, [error, controls, reduceMotion]);

  function handleFocus() {
    setIsFocused(true);
    onFocus?.();
    if (!hasFocusedRef.current && !reduceMotion) {
      hasFocusedRef.current = true;
      controls.start({ ...jiggle.settle, transition: jiggle.settleTransition });
    }
  }

  function handleBlur() {
    setIsFocused(false);
    onBlur?.();
  }

  // Written on a rule rather than boxed in: transparent background, no border
  // except the line being written on. The global :focus-visible outline is off
  // for form controls in index.css, so that treatment is the entire focus
  // affordance and has to be unambiguous on its own — never the browser's blue
  // ring, and never a colour swap alone.
  //
  // A single-line field and the message body need different treatments, and
  // giving both the same one was a real bug: the message body carries the
  // ruled-paper gradient *and* was given the single-line bottom rule on top of
  // it, so focusing a five-line writing area lit exactly one line — the last
  // one — which also sat 5px below the final gradient rule and broke the
  // spacing. The body now has no bottom rule at all; see `isBody` below.
  const isBody = as === "textarea";
  const fieldClasses = "w-full bg-transparent px-1 py-1 text-sm text-fg outline-none";

  return (
    <motion.div
      animate={controls}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative pl-4"
    >
      <label htmlFor={id} className="block font-mono text-xs text-fg-muted">
        {lead}
      </label>

      <div className="relative mt-1">
        {isBody ? (
          <>
            {/* The whole writing area is one surface, so focus is one thing
                happening to all of it — a soft accent wash and a quiet border
                drawn around the entire block, fading in on opacity alone. No
                single rule is singled out, and the rules themselves keep their
                even spacing whether the area is focused or not. */}
            <motion.div
              aria-hidden="true"
              initial={false}
              animate={{ opacity: isFocused || error ? 1 : 0 }}
              transition={{ duration: 0.3, ease: ease.standard }}
              className={cn(
                "pointer-events-none absolute -inset-x-2 -inset-y-1.5 rounded-xl border",
                error ? "border-red-500/50 bg-red-500/[0.05]" : "border-accent/35 bg-accent/[0.05]",
              )}
            />
            <textarea
              id={id}
              rows={RULE.rows}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              // `block`: a textarea is inline by default, so it sat in a line
              // box that added ~6px of descender space beneath it. That space
              // pushed the closing separator off the rule rhythm and is not
              // visible in any inspector as margin or padding.
              className={cn(fieldClasses, "relative block resize-none")}
              style={{
                // Ruled paper. The gradient period is the line height, so every
                // rule is exactly one line apart and typed lines sit on them
                // rather than drifting between them. `local` attachment keeps
                // the rules moving with the text if the body is ever scrolled.
                lineHeight: `${RULE.line}px`,
                backgroundImage: ruledPaper,
                backgroundPosition: `0 ${RULE.offset}px`,
                backgroundAttachment: "local",
              }}
            />
          </>
        ) : (
          <>
            <input
              id={id}
              type={type}
              value={value}
              autoComplete={autoComplete}
              onChange={(e) => onChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className={fieldClasses}
            />

            <span
              aria-hidden="true"
              className={cn("absolute right-0 bottom-0 left-0 h-px", error ? "bg-red-500/70" : "bg-border-strong")}
            />
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={{ scaleX: isFocused ? 1 : 0, opacity: isFocused ? 1 : 0 }}
              transition={{ duration: 0.3, ease: ease.standard }}
              className={cn("absolute right-0 bottom-0 left-0 h-[2px]", error ? "bg-red-500" : "bg-accent")}
              style={{ transformOrigin: "left center" }}
            />
          </>
        )}

        {previewDisplay && (
          <span aria-hidden="true" className="pointer-events-none absolute top-1 left-1 text-sm text-fg-faint">
            {previewDisplay}
            <span className="ml-px inline-block h-[1em] w-px translate-y-[2px] animate-pulse bg-fg-faint" />
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 6 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: ease.standard }}
            className="flex items-center gap-1.5 overflow-hidden text-xs text-red-500"
          >
            <AlertIcon />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MailGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 3 18 9-18 9 4-9-4-9Z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}
