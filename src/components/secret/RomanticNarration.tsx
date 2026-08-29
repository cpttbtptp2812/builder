import { useEffect, useRef, useState } from "react";
import { secretRomance } from "../../data/secretRomance";

const typeProgress = new Map<string, number>();
const HER = secretRomance.herName;

function highlightName(text: string) {
  if (!text.includes(HER)) return text;
  const parts = text.split(HER);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && <em className="secret-name-glow">{HER}</em>}
    </span>
  ));
}

function NarrationStage({ children }: { children: React.ReactNode }) {
  return <div className="secret-narration-stage">{children}</div>;
}

export function RomanticTypewriter({
  text,
  onDone,
  speed = 36,
}: {
  text: string;
  onDone?: () => void;
  speed?: number;
}) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const doneCalled = useRef(false);
  const [shown, setShown] = useState(() => {
    const p = typeProgress.get(text) ?? 0;
    return p >= text.length ? text : text.slice(0, p);
  });
  const [done, setDone] = useState(() => (typeProgress.get(text) ?? 0) >= text.length);

  useEffect(() => {
    doneCalled.current = false;
    let i = typeProgress.get(text) ?? 0;
    if (i >= text.length) {
      setShown(text);
      setDone(true);
      if (!doneCalled.current) {
        doneCalled.current = true;
        onDoneRef.current?.();
      }
      return;
    }
    setShown(text.slice(0, i));
    setDone(false);
    const tick = window.setInterval(() => {
      i += 1;
      typeProgress.set(text, i);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(tick);
        setDone(true);
        if (!doneCalled.current) {
          doneCalled.current = true;
          onDoneRef.current?.();
        }
      }
    }, speed);
    return () => clearInterval(tick);
  }, [text, speed]);

  const visible = shown.includes(HER) ? highlightName(shown) : shown;

  return (
    <NarrationStage>
      <p className={`secret-romantic-type${done ? " done" : ""}`}>
        {typeof visible === "string" ? visible : visible}
        {!done && <span className="secret-type-cursor">|</span>}
      </p>
    </NarrationStage>
  );
}

export function RomanticGlowText({ text, onDone }: { text: string; onDone?: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const chunks = text.match(/[^，。！？——]+[，。！？——]?/g) ?? [text];

  useEffect(() => {
    const ms = chunks.length * 520 + 1000;
    const t = window.setTimeout(() => onDoneRef.current?.(), ms);
    return () => clearTimeout(t);
  }, [text, chunks.length]);

  return (
    <NarrationStage>
      <p className="secret-romantic-glow">
        {chunks.map((chunk, i) => (
          <span
            key={`${chunk}-${i}`}
            className="secret-glow-chunk"
            style={{ animationDelay: `${i * 0.52}s` }}
          >
            {chunk.includes(HER) ? highlightName(chunk) : chunk}
          </span>
        ))}
      </p>
    </NarrationStage>
  );
}

export function RomanticCascade({ parts, onDone }: { parts: string[]; onDone?: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const ms = parts.length * 1100 + 1400;
    const t = window.setTimeout(() => onDoneRef.current?.(), ms);
    return () => clearTimeout(t);
  }, [parts]);

  return (
    <NarrationStage>
      <div className="secret-romantic-cascade">
        {parts.map((part, i) => (
          <p
            key={part}
            className="secret-cascade-line"
            style={{ animationDelay: `${i * 1.1}s` }}
          >
            {part.includes(HER) ? highlightName(part) : part}
          </p>
        ))}
      </div>
    </NarrationStage>
  );
}

export function RomanticBreathe({ text, onDone }: { text: string; onDone?: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = window.setTimeout(() => onDoneRef.current?.(), 4000);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <NarrationStage>
      <div className="secret-romantic-breathe">
        <span className="secret-breathe-ring" />
        <span className="secret-breathe-ring delay" />
        <span className="secret-breathe-ring delay2" />
        <p className="secret-breathe-text">{text.includes(HER) ? highlightName(text) : text}</p>
      </div>
    </NarrationStage>
  );
}

export type NarrationMood = "typewriter" | "glow" | "cascade" | "breathe";

export function RomanticNarration({
  text,
  mood = "typewriter",
  fragments,
  onDone,
}: {
  text: string;
  mood?: NarrationMood;
  fragments?: string[];
  onDone?: () => void;
}) {
  if (mood === "glow") return <RomanticGlowText text={text} onDone={onDone} />;
  if (mood === "cascade" && fragments?.length)
    return <RomanticCascade parts={fragments} onDone={onDone} />;
  if (mood === "breathe") return <RomanticBreathe text={text} onDone={onDone} />;
  return <RomanticTypewriter text={text} onDone={onDone} />;
}
