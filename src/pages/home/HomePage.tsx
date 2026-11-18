import React, { useEffect, useRef, useState } from "react";
import { Button, Input, Modal } from "antd";
import { ArrowRightOutlined, StarFilled } from "@ant-design/icons";

export interface DreamoraStar {
  id: string;
  dream: string;
  response: string;
  mode: string;
  createdAt: string;
}
interface HomePageProps {
  onLaunchDream: (dream: string, mode: string) => void;
  arrivalDream?: DreamoraStar | null;
  onDismissArrival?: () => void;
  onContinueDream?: (dream: DreamoraStar) => void;
}
const STORAGE_KEY = "dreamora-stars-v1";
const readStars = (): DreamoraStar[] => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id && item.dream) : [];
  } catch { return []; }
};
const css = [
".dreamora *{box-sizing:border-box}.dreamora{position:relative;min-height:100%;overflow:hidden;background:#050812;color:#f5f0e7;font-family:Inter,'PingFang SC','Microsoft YaHei',sans-serif}",
".dreamora-bg{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 14%,rgba(63,72,143,.3),transparent 42%),radial-gradient(ellipse at 18% 52%,rgba(32,75,115,.18),transparent 36%),radial-gradient(ellipse at 84% 72%,rgba(92,48,115,.17),transparent 34%),linear-gradient(180deg,#070b18,#090d1c 48%,#050812)}",
".dreamora-nebula{position:absolute;inset:-20%;pointer-events:none;opacity:.38;filter:blur(44px);background:conic-gradient(from 210deg at 50% 50%,transparent,rgba(68,89,168,.16),transparent 42%,rgba(119,72,145,.13),transparent);animation:nebula-drift 42s ease-in-out infinite alternate}",
".dreamora-starfield{position:absolute;inset:0;pointer-events:none;overflow:hidden}.dreamora-particle{position:absolute;width:2px;height:2px;border-radius:50%;background:#d8e4ff;box-shadow:0 0 7px 1px rgba(177,202,255,.55);animation:star-twinkle 4s ease-in-out infinite}",
".dreamora-header{position:relative;z-index:3;max-width:1320px;margin:auto;padding:26px 5.5vw;display:flex;align-items:center;justify-content:space-between}.dreamora-brand{display:flex;align-items:center;gap:12px;color:#eee8dc;letter-spacing:4px;font-size:12px;font-weight:600}.dreamora-brand-mark{width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7dc,#d9c18f 22%,#8876b4 55%,transparent 72%);box-shadow:0 0 24px rgba(207,190,255,.65)}",
".dreamora-nav{border:1px solid rgba(190,205,255,.15);background:rgba(14,20,39,.45);border-radius:999px;padding:9px 16px;color:#aeb8d2;font-size:12px;letter-spacing:1px;cursor:pointer;transition:all .25s}.dreamora-nav:hover{border-color:rgba(211,195,255,.45);color:#fff;box-shadow:0 0 24px rgba(125,143,255,.13)}",
".dreamora-hero{position:relative;z-index:1;min-height:min(820px,calc(100vh - 70px));padding:80px 22px 110px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.dreamora-kicker{color:#b5a9d8;font-size:10px;letter-spacing:6px;margin-bottom:28px}.dreamora-title{font-weight:300;font-size:clamp(42px,6.4vw,82px);line-height:1.35;letter-spacing:3px;margin:0;color:#f4f0e9;text-shadow:0 0 46px rgba(181,190,255,.13)}.dreamora-title em{font-style:normal;color:#d9c7ff;text-shadow:0 0 35px rgba(186,157,255,.38)}.dreamora-subtitle{max-width:620px;margin:25px auto 0;color:#9ca8c4;font-size:14px;line-height:2.2;letter-spacing:1px}",
".dreamora-orbit{position:absolute;left:50%;top:47%;width:min(64vw,690px);height:min(64vw,690px);transform:translate(-50%,-50%);border:1px solid rgba(168,184,255,.09);border-radius:50%;box-shadow:0 0 100px rgba(82,99,174,.07),inset 0 0 90px rgba(86,105,181,.045);pointer-events:none}.dreamora-orbit:before,.dreamora-orbit:after{content:'';position:absolute;inset:10%;border:1px solid rgba(168,184,255,.055);border-radius:50%}.dreamora-orbit:after{inset:22%;border-color:rgba(215,190,255,.055)}",
".dreamora-editor-wrap{position:relative;width:min(720px,94vw);margin-top:52px;text-align:left}.dreamora-editor{position:relative;padding:26px 28px 20px;border:1px solid rgba(178,191,244,.22);border-radius:22px;background:linear-gradient(145deg,rgba(20,28,54,.88),rgba(9,14,29,.9));box-shadow:0 26px 90px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.05);backdrop-filter:blur(20px);transition:border-color .3s,box-shadow .3s}.dreamora-editor:focus-within{border-color:rgba(207,187,255,.52);box-shadow:0 26px 100px rgba(0,0,0,.42),0 0 48px rgba(132,117,221,.12)}.dreamora-editor .ant-input,.dreamora-editor textarea{background:transparent!important;color:#f1edf8!important;border:0!important;box-shadow:none!important;resize:none!important;font-size:16px!important;line-height:2!important}.dreamora-editor textarea::placeholder{color:#77829e!important}",
".dreamora-editor-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding-top:17px;border-top:1px solid rgba(190,200,240,.11)}.dreamora-modes{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}.dreamora-mode{border:1px solid rgba(177,190,235,.16);border-radius:999px;background:rgba(255,255,255,.025);padding:8px 12px;color:#9ca8c4;font-size:11px;cursor:pointer;transition:all .2s}.dreamora-mode.active{color:#f2e9ff;border-color:rgba(194,170,255,.55);background:rgba(148,119,218,.16);box-shadow:0 0 20px rgba(149,120,230,.12)}",
".dreamora-launch{height:46px!important;padding:0 21px!important;border:0!important;border-radius:999px!important;background:linear-gradient(110deg,#e6d6ff,#c6b0f0 52%,#e8d7b7)!important;color:#171426!important;font-weight:650!important;box-shadow:0 8px 28px rgba(174,143,236,.23)!important}.dreamora-launch:hover{transform:translateY(-2px);box-shadow:0 12px 38px rgba(174,143,236,.34)!important}.dreamora-caption{margin:15px 0 0;text-align:center;color:#74809e;font-size:11px;letter-spacing:1px}",
".dreamora-section{position:relative;z-index:1;padding:82px 5vw 100px;border-top:1px solid rgba(178,191,244,.09);background:linear-gradient(180deg,rgba(255,255,255,.012),rgba(255,255,255,.025),rgba(255,255,255,.005))}.dreamora-inner{max-width:1120px;margin:auto}.dreamora-section-kicker{text-align:center;color:#9f91c7;font-size:10px;letter-spacing:5px;margin-bottom:18px}.dreamora-section-title{text-align:center;margin:0;color:#eee9f5;font-size:clamp(26px,3.4vw,40px);font-weight:350;letter-spacing:2px}.dreamora-section-desc{text-align:center;color:#8995b1;font-size:13px;line-height:2;margin:16px auto 42px;max-width:620px}",
".dreamora-galaxy{position:relative;min-height:310px;border:1px solid rgba(175,190,255,.13);border-radius:26px;overflow:hidden;background:radial-gradient(ellipse at 50% 50%,rgba(94,86,158,.16),transparent 52%),linear-gradient(135deg,rgba(17,24,48,.72),rgba(8,13,28,.82));box-shadow:inset 0 0 90px rgba(79,94,166,.08)}.dreamora-galaxy:before{content:'';position:absolute;inset:0;background-image:radial-gradient(1px 1px at 18% 30%,rgba(220,226,255,.65) 50%,transparent 100%),radial-gradient(1px 1px at 70% 24%,rgba(220,226,255,.6) 50%,transparent 100%),radial-gradient(1px 1px at 84% 72%,rgba(220,226,255,.55) 50%,transparent 100%);pointer-events:none}.dreamora-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;color:#8792ae;gap:12px;padding:28px}.dreamora-empty-orb{width:54px;height:54px;border-radius:50%;border:1px solid rgba(207,190,255,.3);box-shadow:0 0 45px rgba(165,146,255,.16),inset 0 0 22px rgba(165,146,255,.14);display:grid;place-items:center;color:#d8c7ff;font-size:19px}",
".dreamora-star-button{position:absolute;z-index:2;display:flex;align-items:center;gap:8px;max-width:220px;border:0;background:transparent;color:#e8e1f6;cursor:pointer;transform:translate(-50%,-50%);text-align:left}.dreamora-star-dot{flex:none;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#f4e7ff 23%,#bca6ed 58%,#8b72ca);box-shadow:0 0 9px 3px rgba(200,180,255,.45),0 0 25px rgba(169,142,255,.35);transition:all .3s}.dreamora-star-button:hover .dreamora-star-dot{transform:scale(1.8);box-shadow:0 0 14px 6px rgba(218,197,255,.6),0 0 42px rgba(169,142,255,.55)}.dreamora-star-label{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 8px #050812;opacity:.86}.dreamora-count{position:absolute;right:22px;top:18px;color:#7f8ba9;font-size:10px;letter-spacing:2px}",
".dreamora-principles{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin:78px auto 0;max-width:1000px}.dreamora-principle{padding:22px 8px 0;border-top:1px solid rgba(181,192,239,.2)}.dreamora-principle b{display:block;color:#d8c8f1;font-size:13px;font-weight:500;letter-spacing:1px;margin-bottom:12px}.dreamora-principle p{margin:0;color:#8590aa;font-size:12px;line-height:2}.dreamora-footer{position:relative;z-index:1;padding:30px 20px 42px;text-align:center;color:#69748f;font-size:10px;letter-spacing:2px}",
".dreamora-meteor-layer{position:fixed;inset:0;z-index:99;pointer-events:none;overflow:hidden}.dreamora-meteor{position:absolute;left:50%;top:58%;width:7px;height:7px;border-radius:50%;background:#fff8e9;box-shadow:0 0 14px 5px #d6c6ff,0 0 44px 12px rgba(159,133,255,.72)}.dreamora-meteor:after{content:'';position:absolute;left:3px;top:1px;width:190px;height:3px;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(173,154,255,.08),rgba(218,204,255,.85),#fff);filter:blur(1px)}.dreamora-meteor.launch{animation:meteor-launch 1.45s cubic-bezier(.16,.72,.22,1) forwards}.dreamora-meteor.arrive{left:8%;top:86%;animation:meteor-arrive 2.35s cubic-bezier(.18,.68,.16,1) forwards}.dreamora-arrival-copy{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);color:#eee5ff;font-size:13px;letter-spacing:4px;text-shadow:0 0 22px rgba(204,181,255,.7);animation:arrival-copy 2.5s ease forwards;white-space:nowrap}.dreamora-arrival-subcopy{position:absolute;left:50%;top:52%;width:min(560px,84vw);transform:translate(-50%,-50%);color:#aeb8d2;font-size:12px;line-height:1.8;text-align:center;text-shadow:0 0 14px rgba(204,181,255,.4);animation:arrival-copy 2.5s ease forwards;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
".dreamora-modal .ant-modal-content{background:linear-gradient(145deg,#141b33,#080d1d)!important;border:1px solid rgba(196,181,255,.22);border-radius:22px;box-shadow:0 30px 100px rgba(0,0,0,.55)}.dreamora-modal .ant-modal-close{color:#aeb8d2}.dreamora-modal-title{color:#e8dcff;font-size:11px;letter-spacing:4px;margin-bottom:18px}.dreamora-modal-dream{font-size:20px;line-height:1.8;color:#f4efff;margin-bottom:24px}.dreamora-modal-response{font-size:14px;line-height:2;color:#aeb8d2;white-space:pre-wrap;max-height:42vh;overflow:auto;border-top:1px solid rgba(190,200,240,.14);padding-top:20px}",
"@keyframes star-twinkle{0%,100%{opacity:.22;transform:scale(.7)}50%{opacity:.95;transform:scale(1.5)}}@keyframes nebula-drift{0%{transform:rotate(-8deg) scale(1)}100%{transform:rotate(12deg) scale(1.12)}}@keyframes meteor-launch{0%{transform:translate(-50%,0) scale(1);opacity:1}18%{opacity:1}100%{transform:translate(45vw,-75vh) scale(.16);opacity:0}}@keyframes meteor-arrive{0%{transform:translate(0,0) scale(1);opacity:0}12%{opacity:1}88%{opacity:1}100%{transform:translate(68vw,-65vh) scale(.14);opacity:0}}@keyframes arrival-copy{0%,18%{opacity:0}35%,72%{opacity:1}100%{opacity:0}}",
"@media(max-width:700px){.dreamora-header{padding:20px 22px}.dreamora-hero{padding:75px 18px 90px;min-height:700px}.dreamora-title{font-size:clamp(38px,11vw,58px);letter-spacing:1px}.dreamora-subtitle{font-size:12px}.dreamora-editor{padding:20px 17px 16px}.dreamora-editor-foot{align-items:flex-start;flex-direction:column}.dreamora-editor-foot .ant-btn{width:100%}.dreamora-orbit{width:88vw;height:88vw;top:42%}.dreamora-section{padding:68px 18px 78px}.dreamora-galaxy{min-height:280px}.dreamora-principles{grid-template-columns:1fr;gap:25px;margin-top:55px}.dreamora-star-label{max-width:120px}.dreamora-brand{letter-spacing:2px}}@media(prefers-reduced-motion:reduce){.dreamora-particle,.dreamora-nebula,.dreamora-meteor,.dreamora-arrival-copy,.dreamora-arrival-subcopy{animation:none!important}.dreamora-launch,.dreamora-nav,.dreamora-star-dot{transition:none!important}}"
".dreamora-galaxy:before{background:none!important}.dreamora-hero:after{content:'\u0027\u0027;position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(240px circle at var(--mx,50%) var(--my,50%),rgba(151,132,255,.13),transparent 76%)}.dreamora-galaxy{background-image:radial-gradient(260px circle at var(--mx,50%) var(--my,50%),rgba(130,115,230,.16),transparent 72%),radial-gradient(ellipse at 50% 45%,rgba(99,91,175,.24),transparent 45%),radial-gradient(ellipse at 15% 20%,rgba(36,99,147,.15),transparent 34%),linear-gradient(135deg,rgba(17,24,48,.82),rgba(5,9,23,.95))}.dreamora-hero{isolation:isolate}.dreamora-hero>*:not(.dreamora-hero-starfield){position:relative;z-index:2}.dreamora-hero-starfield{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}.dreamora-memory-star{position:absolute;left:var(--sx);top:var(--sy);width:34px;height:34px;transform:translate(-50%,-50%);border:0;border-radius:50%;background:transparent;display:grid;place-items:center;cursor:pointer;pointer-events:auto}.dreamora-memory-star:before{content:'';width:5px;height:5px;border-radius:50%;background:#fff;box-shadow:0 0 8px 3px rgba(197,181,255,.85),0 0 24px 8px rgba(145,124,255,.48);transition:transform .35s,box-shadow .35s}.dreamora-memory-star:after{content:'';position:absolute;inset:5px;border:1px solid rgba(198,181,255,0);border-radius:50%;transition:all .35s}.dreamora-memory-star:hover:before,.dreamora-memory-star:focus-visible:before{transform:scale(2.2);box-shadow:0 0 12px 5px rgba(224,207,255,.9),0 0 38px 14px rgba(145,124,255,.7)}.dreamora-memory-star:hover:after,.dreamora-memory-star:focus-visible:after{inset:-4px;border-color:rgba(198,181,255,.42);box-shadow:0 0 18px rgba(150,128,255,.22)}.dreamora-memory-star span{position:absolute;top:25px;left:50%;transform:translateX(-50%);white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;padding:5px 9px;border:1px solid rgba(194,181,255,.2);border-radius:8px;background:rgba(8,12,28,.88);color:#e9e0ff;font-size:10px;opacity:0;transition:opacity .2s;pointer-events:none}.dreamora-memory-star:hover span,.dreamora-memory-star:focus-visible span{opacity:1}",
".dreamora-galaxy{min-height:520px;perspective:1000px;background:radial-gradient(ellipse at 50% 45%,rgba(99,91,175,.24),transparent 45%),radial-gradient(ellipse at 15% 20%,rgba(36,99,147,.15),transparent 34%),linear-gradient(135deg,rgba(17,24,48,.82),rgba(5,9,23,.95));box-shadow:inset 0 0 140px rgba(79,94,166,.13),0 24px 90px rgba(0,0,0,.18)}.dreamora-galaxy:after{content:'';position:absolute;inset:-30%;pointer-events:none;background:conic-gradient(from 20deg at 50% 50%,transparent,rgba(131,117,214,.08),transparent 34%,rgba(79,146,180,.08),transparent 68%);filter:blur(22px);animation:nebula-drift 34s linear infinite alternate}.dreamora-constellation-lines{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;opacity:.7}.dreamora-constellation-lines line{stroke:rgba(177,164,255,.24);stroke-width:1;stroke-dasharray:3 8;animation:line-flow 12s linear infinite}.dreamora-star-button{z-index:3;gap:10px;padding:12px 14px;border-radius:999px;transition:background .28s,filter .28s;max-width:min(260px,45vw)}.dreamora-star-button:hover,.dreamora-star-button:focus-visible{background:rgba(128,111,194,.13);filter:drop-shadow(0 0 18px rgba(161,141,255,.32));outline:none}.dreamora-star-dot{width:12px;height:12px;animation:star-pulse 3.4s ease-in-out infinite}.dreamora-star-button:nth-of-type(3n) .dreamora-star-dot{animation-delay:-1.2s}.dreamora-star-button:nth-of-type(4n) .dreamora-star-dot{animation-delay:-2.1s}.dreamora-star-label{max-width:180px}.dreamora-star-hint{position:absolute;left:22px;bottom:18px;color:#8290b2;font-size:10px;letter-spacing:1px;z-index:3}.dreamora-galaxy .dreamora-count{z-index:4}.dreamora-modal-response{max-height:36vh}.dreamora-modal-actions{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:24px}.dreamora-continue{border:0!important;border-radius:999px!important;height:42px!important;padding:0 20px!important;background:linear-gradient(110deg,#d9c7ff,#a996e8 55%,#d9c7ff)!important;color:#171426!important;font-weight:650!important;box-shadow:0 8px 30px rgba(174,143,236,.2)!important}.dreamora-continue:hover{transform:translateY(-2px);box-shadow:0 12px 38px rgba(174,143,236,.4)!important}",
"@keyframes star-pulse{0%,100%{box-shadow:0 0 9px 3px rgba(200,180,255,.45),0 0 25px rgba(169,142,255,.35)}50%{box-shadow:0 0 15px 6px rgba(218,197,255,.72),0 0 38px rgba(169,142,255,.6)}}@keyframes line-flow{to{stroke-dashoffset:-90}}",
"@media(max-width:700px){.dreamora-galaxy{min-height:440px}.dreamora-star-button{padding:8px 10px;max-width:50vw}.dreamora-star-label{max-width:120px}.dreamora-memory-star span{max-width:120px}.dreamora-modal-actions{flex-direction:column-reverse}.dreamora-modal-actions .ant-btn{width:100%}}",
].join("\n");
const modes = [{id:"倾听",label:"只想记录"},{id:"探索",label:"陪我探索"},{id:"规划",label:"帮我规划"},{id:"创造",label:"一起创造"},{id:"研究",label:"帮我研究"},{id:"行动",label:"开始行动"}];

const HomePage: React.FC<HomePageProps> = ({ onLaunchDream, arrivalDream, onDismissArrival, onContinueDream }) => {
  const [dream, setDream] = useState("");
  const [mode, setMode] = useState("倾听");
  const [stars, setStars] = useState<DreamoraStar[]>(readStars);
  const [selectedStar, setSelectedStar] = useState<DreamoraStar | null>(null);
  const [launching, setLaunching] = useState(false);
  const [showArrival, setShowArrival] = useState(false);
  const launchTimer = useRef<number | null>(null);
  const arrivalTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!arrivalDream) return;
    setStars((current) => {
      const exists = current.some((item) => item.id === arrivalDream.id);
      const next = exists
        ? current.map((item) => item.id === arrivalDream.id ? arrivalDream : item)
        : [arrivalDream, ...current].slice(0, 100);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
      return next;
    });
    setShowArrival(true);
    arrivalTimer.current = window.setTimeout(() => {
      setShowArrival(false);
      onDismissArrival?.();
    }, 2600);
    return () => { if (arrivalTimer.current !== null) window.clearTimeout(arrivalTimer.current); };
  }, [arrivalDream, onDismissArrival]);

  useEffect(() => () => {
    if (launchTimer.current !== null) window.clearTimeout(launchTimer.current);
    if (arrivalTimer.current !== null) window.clearTimeout(arrivalTimer.current);
  }, []);

  const launch = () => {
    const value = dream.trim();
    if (!value || launching) return;
    setLaunching(true);
    launchTimer.current = window.setTimeout(() => {
      onLaunchDream(value, mode);
      setLaunching(false);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 1250);
  };

  const particles = Array.from({ length: 72 }, (_, index) => ({
    left: ((index * 47 + 13) % 97) + "%",
    top: ((index * 31 + 7) % 94) + "%",
    delay: ((index * 13) % 40) / 10 + "s",
    opacity: 0.25 + ((index * 17) % 65) / 100
  }));

  return (
    <main className="dreamora" style={{ width: "100%", height: "100%", overflowY: "auto", overflowX: "hidden" }}>
      <style>{css}</style>
      <div className="dreamora-bg" /><div className="dreamora-nebula" />
      <div className="dreamora-starfield">
        {particles.map((p, i) => <span key={i} className="dreamora-particle" style={{left:p.left,top:p.top,animationDelay:p.delay,opacity:p.opacity}} />)}
      </div>
      <header className="dreamora-header">
        <div className="dreamora-brand"><span className="dreamora-brand-mark" /> DREAMORA</div>
        <button className="dreamora-nav" onClick={() => document.getElementById("dreamora-galaxy")?.scrollIntoView({behavior:"smooth",block:"center"})}>我的星辰 · {stars.length}</button>
      </header>

      <section className="dreamora-hero" onPointerMove={(event)=>{const rect=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty("--mx",((event.clientX-rect.left)/rect.width*100)+"%");event.currentTarget.style.setProperty("--my",((event.clientY-rect.top)/rect.height*100)+"%");}}>
        <div className="dreamora-orbit" />
        <div className="dreamora-hero-starfield" aria-label="梦想星辰">{stars.map((star,index)=><button key={"hero-"+star.id} type="button" className="dreamora-memory-star" style={{"--sx":(8+((index*43+11)%84))+"%","--sy":(8+((index*29+13)%82))+"%"} as React.CSSProperties} onClick={()=>setSelectedStar(star)} aria-label={"打开梦想："+star.dream}><span>{star.dream}</span></button>)}</div>
        <div className="dreamora-kicker">A UNIVERSE FOR EVERY DREAM</div>
        <h1 className="dreamora-title">每一个梦想，<br /><em>都值得拥有一颗星星。</em></h1>
        <p className="dreamora-subtitle">这里不衡量梦想的大小，也不追问它是否现实。<br />你只需要写下来，让它被听见、被理解，然后在宇宙里留下光。</p>
        <div className="dreamora-editor-wrap">
          <div className="dreamora-editor">
            <div style={{display:"flex",alignItems:"center",gap:9,color:"#b9acd9",fontSize:10,letterSpacing:3,marginBottom:16}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#d8c4ff",boxShadow:"0 0 12px #c6a9ff"}} /> YOUR DREAM BEGINS HERE
            </div>
            <Input.TextArea value={dream} onChange={(e)=>setDream(e.target.value)} onPressEnter={(e)=>{if(!e.shiftKey){e.preventDefault();launch();}}} placeholder="如果可以不考虑任何限制，你最想做的事情是什么？" autoSize={{minRows:3,maxRows:6}} maxLength={1000} aria-label="写下你的梦想" bordered={false} />
            <div className="dreamora-modes" aria-label="选择希望获得的回应">
              {modes.map((item)=><button key={item.id} type="button" className={"dreamora-mode"+(mode===item.id?" active":"")} onClick={()=>setMode(item.id)} aria-pressed={mode===item.id}>{item.label}</button>)}
            </div>
            <div className="dreamora-editor-foot">
              <span style={{color:"#74809e",fontSize:11,lineHeight:1.8}}>{dream.length}/1000 · 不必伟大，不必合理，也不必向谁解释。</span>
              <Button className="dreamora-launch" onClick={launch} disabled={!dream.trim()||launching}>{launching?"让梦想启程…":"让梦想启程"} <ArrowRightOutlined /></Button>
            </div>
          </div>
          <p className="dreamora-caption">你的文字将化作一颗流星，进入属于你的星空。</p>
        </div>
      </section>

      <section id="dreamora-galaxy" className="dreamora-section">
        <div className="dreamora-inner">
          <div className="dreamora-section-kicker">YOUR PERSONAL CONSTELLATION</div>
          <h2 className="dreamora-section-title">你的梦想宇宙</h2>
          <p className="dreamora-section-desc">每一次认真写下的梦想，都会在这里留下自己的位置。<br />星星不需要比较明暗，每一颗都有它存在的理由。</p><div style={{textAlign:"center",color:"#68748f",fontSize:10,letterSpacing:1,marginTop:-28,marginBottom:26}}>星辰暂存在这台设备的浏览器中，不会自动公开或上传。</div>
          <div className="dreamora-galaxy" onPointerMove={(event)=>{const rect=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty("--mx",((event.clientX-rect.left)/rect.width*100)+"%");event.currentTarget.style.setProperty("--my",((event.clientY-rect.top)/rect.height*100)+"%");}}>
            <span className="dreamora-count">{String(stars.length).padStart(2,"0")} DREAM STARS</span>
            {stars.length===0 ? <div className="dreamora-empty"><div className="dreamora-empty-orb"><StarFilled /></div><div style={{color:"#c5bddc",fontSize:14,letterSpacing:2}}>星图正在等待第一个坐标</div><div style={{fontSize:11,lineHeight:1.9}}>写下一个梦想，它就会在这片宇宙中点亮自己的位置。</div></div> : <>
              <svg className="dreamora-constellation-lines" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
                {stars.map((star,index)=>{const x=10+((index*37+9)%80),y=22+((index*29+7)%60);if(!stars[index+1])return null;const nx=10+(((index+1)*37+9)%80),ny=22+(((index+1)*29+7)%60);return <line key={star.id+"-line"} x1={x*10} y1={y*5.2} x2={nx*10} y2={ny*5.2} />;})}
              </svg>
              {stars.map((star,index)=><button key={star.id} type="button" className="dreamora-star-button" style={{left:(10+((index*37+9)%80))+"%",top:(22+((index*29+7)%60))+"%"}} onClick={()=>setSelectedStar(star)} aria-label={"打开梦想："+star.dream} title="点击，重新看见这份梦想"><span className="dreamora-star-dot"/><span className="dreamora-star-label">{star.dream}</span></button>)}
              <span className="dreamora-star-hint">✦ 每一颗亮星，都是一份真实写下的梦想 · 点击星星探索</span>
            </>}
          </div>
          <div className="dreamora-principles">
            <div className="dreamora-principle"><b>01 · 不按身份衡量</b><p>不因为财富、学历、职业、出身或地位，决定一个人的梦想是否值得被听见。</p></div>
            <div className="dreamora-principle"><b>02 · 不把梦想排名</b><p>梦想没有排行榜。宏大的愿望和微小的心愿，都可以在这里拥有自己的位置。</p></div>
            <div className="dreamora-principle"><b>03 · 不替你定义人生</b><p>AI 可以倾听、整理、提供帮助，但人生要去哪里，始终由你自己决定。</p></div>
          </div>
        </div>
      </section>
      <footer className="dreamora-footer">愿每一个梦想，都能在宇宙里找到自己的位置。</footer>

      {launching&&<div className="dreamora-meteor-layer" aria-hidden="true"><span className="dreamora-meteor launch"/></div>}
      {showArrival&&arrivalDream&&<div className="dreamora-meteor-layer" aria-live="polite"><span className="dreamora-meteor arrive"/><span className="dreamora-arrival-copy">你的回应，正在化作星光</span><span className="dreamora-arrival-subcopy">{arrivalDream.response.slice(0, 56)}</span></div>}
      <Modal open={!!selectedStar} onCancel={()=>setSelectedStar(null)} footer={null} centered width={680} className="dreamora-modal" title={null}>
        {selectedStar&&<div style={{padding:"12px 8px 8px"}}>
          <div className="dreamora-modal-title">A DREAM, KEPT IN THE UNIVERSE</div>
          <div className="dreamora-modal-dream">{selectedStar.dream}</div>
          <div style={{color:"#8f82b2",fontSize:10,letterSpacing:2,marginBottom:10}}>{selectedStar.mode} · {new Date(selectedStar.createdAt).toLocaleDateString("zh-CN")}</div>
          <div className="dreamora-modal-response">{selectedStar.response||"这颗星星记录了一个梦想。"}</div>
          <div className="dreamora-modal-actions"><Button onClick={()=>setSelectedStar(null)} style={{borderRadius:999,background:"rgba(255,255,255,.06)",borderColor:"rgba(190,180,230,.25)",color:"#e8ddff"}}>回到星空</Button><Button className="dreamora-continue" onClick={()=>{const dream=selectedStar;setSelectedStar(null);if(dream)onContinueDream?.(dream);}}>继续这场对话 <ArrowRightOutlined /></Button></div>
        </div>}
      </Modal>
    </main>
  );
};
export default HomePage;
