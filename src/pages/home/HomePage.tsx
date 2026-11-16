import React, { useState } from "react";
import { Button, Input } from "antd";
import { ArrowDownOutlined, ArrowRightOutlined, HeartOutlined } from "@ant-design/icons";

interface HomePageProps {
  onEnterWorkbench: () => void;
  onEnterWorkbenchWithPrompt?: (prompt: string, autoSend?: boolean) => void;
  onLaunchWorkflow?: (workflow: any) => void;
  onOpenRepositories?: () => void;
  onOpenModal: (tab: "settings" | "knowledge" | "tools" | "logs" | "agents" | "workflows") => void;
  workflows?: any[];
}

const HomePage: React.FC<HomePageProps> = ({ onEnterWorkbench, onEnterWorkbenchWithPrompt }) => {
  const [dream, setDream] = useState("");
  const trimmedDream = dream.trim();

  const startWriting = () => {
    const prompt = trimmedDream
      ? `我想认真记录一个对我有意义的梦想：${trimmedDream}。请先理解我真正想表达的东西，温和地陪我梳理它。不要因为它看起来不现实、没有用或不够宏大而评价它，也不要擅自把它变成赚钱或成功计划。由我决定接下来怎么做。`
      : "我想认真探索一个属于自己的梦想。请先问我：如果不必考虑钱、身份和别人的眼光，我最想做什么？先倾听和理解，不要急着评价或替我做决定。";

    // 只把内容带入工作台输入框，不自动发送，让用户保留最后的决定权。
    if (onEnterWorkbenchWithPrompt) {
      onEnterWorkbenchWithPrompt(prompt, false);
    } else {
      onEnterWorkbench();
    }
  };

  const principles = [
    {
      number: "01",
      title: "不按身份衡量",
      description: "不因为财富、学历、职业、出身或地位，决定一个人的梦想是否值得被听见。",
    },
    {
      number: "02",
      title: "不把梦想排名",
      description: "梦想没有排行榜。宏大的愿望和微小的心愿，都可以在这里拥有自己的位置。",
    },
    {
      number: "03",
      title: "不替你定义人生",
      description: "AI 可以倾听、整理、提供帮助，但人生要去哪里，始终由你自己决定。",
    },
  ];

  return (
    <main
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        background: "#10151b",
        color: "#f3eee5",
        fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      <style>{`
        .dream-home * { box-sizing: border-box; }
        .dream-star { position:absolute; width:2px; height:2px; border-radius:50%; background:#e7d7b8; opacity:.65; box-shadow:0 0 9px rgba(231,215,184,.65); }
        .dream-link { color:#c9b48f; text-decoration:none; transition:color .2s ease; }
        .dream-link:hover { color:#f0dfbf; }
        .dream-cta { transition:transform .2s ease, background .2s ease, box-shadow .2s ease; }
        .dream-cta:hover { transform:translateY(-2px); box-shadow:0 12px 34px rgba(0,0,0,.24); }
        .dream-input.ant-input, .dream-input .ant-input { background:transparent !important; color:#f3eee5 !important; border:0 !important; box-shadow:none !important; }
        .dream-input.ant-input::placeholder, .dream-input .ant-input::placeholder { color:#888b8d !important; }
        .dream-principle { border-top:1px solid rgba(210,190,156,.22); padding-top:22px; }
        @media (max-width: 640px) {
          .dream-hero-title { font-size:clamp(38px, 12vw, 58px) !important; }
          .dream-section { padding-left:22px !important; padding-right:22px !important; }
          .dream-orbit { width:220px !important; height:220px !important; }
          .dream-principles { grid-template-columns:1fr !important; gap:34px !important; }
          .dream-editor { padding:22px 18px 18px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dream-cta, .dream-link { transition:none !important; }
          .dream-cta:hover { transform:none !important; }
        }
      `}</style>

      <div className="dream-home" style={{ position: "relative", minHeight: "100%", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 18%, rgba(116,103,83,.20), transparent 48%), linear-gradient(180deg,#10151b 0%,#151b21 58%,#10151b 100%)" }} />
        {[
          ["12%", "17%"], ["22%", "31%"], ["79%", "14%"], ["87%", "34%"], ["68%", "8%"],
          ["8%", "48%"], ["92%", "58%"], ["31%", "9%"], ["73%", "43%"], ["17%", "66%"],
        ].map(([left, top], index) => (
          <span key={index} className="dream-star" style={{ left, top }} />
        ))}

        <header className="dream-section" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "28px 42px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, letterSpacing: "3px", fontSize: 12, color: "#d8c6a6", fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9b48f", boxShadow: "0 0 12px #c9b48f" }} />
            A PLACE FOR EVERY DREAM
          </div>
          <span style={{ color: "#85898b", fontSize: 12, letterSpacing: "1px" }}>一个平等倾听的空间</span>
        </header>

        <section className="dream-section" style={{ position: "relative", zIndex: 1, minHeight: "min(720px, calc(100vh - 80px))", padding: "70px 24px 100px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div className="dream-orbit" style={{ position: "absolute", width: 310, height: 310, top: "50%", left: "50%", transform: "translate(-50%,-55%)", borderRadius: "50%", border: "1px solid rgba(207,185,146,.12)", boxShadow: "0 0 90px rgba(190,164,120,.08), inset 0 0 70px rgba(190,164,120,.04)", pointerEvents: "none" }}>
            <div style={{ position: "absolute", width: 9, height: 9, borderRadius: "50%", background: "#d7c29e", top: 34, right: 48, boxShadow: "0 0 22px 5px rgba(215,194,158,.28)" }} />
          </div>
          <div style={{ position: "relative", width: 54, height: 54, marginBottom: 34, borderRadius: "50%", background: "linear-gradient(145deg,#e6d6b7,#9f8c6b)", boxShadow: "0 0 55px rgba(215,194,158,.18)" }}>
            <div style={{ position: "absolute", width: 48, height: 48, borderRadius: "50%", background: "#151b21", top: -7, left: 15 }} />
          </div>
          <div style={{ position: "relative", color: "#b7a789", fontSize: 11, letterSpacing: "5px", marginBottom: 28 }}>A WORLD WITHOUT RANKING</div>
          <h1 className="dream-hero-title" style={{ position: "relative", margin: 0, color: "#f3eee5", fontSize: "clamp(42px, 6.2vw, 76px)", lineHeight: 1.38, fontWeight: 400, letterSpacing: "2px" }}>
            你不必先成为谁，
            <br />
            <span style={{ color: "#d5bd94" }}>才配拥有梦想。</span>
          </h1>
          <p style={{ position: "relative", maxWidth: 650, margin: "28px 0 0", color: "#a9a9a4", fontSize: 15, lineHeight: 2.1, letterSpacing: "1px" }}>
            不看出身，不问财富，不比较成就。
            <br />
            无论你的梦想有多大、多小、多遥远，都值得被认真听见。
          </p>
          <a href="#write-dream" className="dream-link" style={{ position: "relative", marginTop: 54, display: "inline-flex", alignItems: "center", gap: 12, fontSize: 13, letterSpacing: "2px" }}>
            留下一个只属于你的愿望 <ArrowDownOutlined />
          </a>
        </section>

        <section className="dream-section" style={{ position: "relative", zIndex: 1, padding: "92px 24px 96px", borderTop: "1px solid rgba(220,207,184,.09)", borderBottom: "1px solid rgba(220,207,184,.09)", background: "rgba(255,255,255,.018)" }}>
          <div style={{ maxWidth: 790, margin: "0 auto", textAlign: "center" }}>
            <div style={{ color: "#b7a789", fontSize: 11, letterSpacing: "4px", marginBottom: 24 }}>A DREAM DOESN'T NEED A RANK</div>
            <h2 style={{ margin: "0 0 24px", color: "#eee8dc", fontSize: "clamp(25px, 3.6vw, 38px)", lineHeight: 1.6, fontWeight: 400 }}>
              人的价值，不该由他拥有多少来决定。
              <br />
              梦想的价值，也不该由它能带来什么来决定。
            </h2>
            <p style={{ margin: 0, color: "#999b99", fontSize: 14, lineHeight: 2.25 }}>
              有人想改变世界，有人只想开一家小小的书店。
              <br />
              有人想去遥远的地方，有人只想和重要的人好好生活。
              <br />
              这些愿望不需要彼此比较，也不需要向谁证明它们有用。
            </p>
            <p style={{ margin: "30px 0 0", color: "#d4c2a3", fontSize: 16, letterSpacing: "1px" }}>
              在这里，没有谁的梦想天生比另一个更重要。
            </p>
          </div>
        </section>

        <section className="dream-section" style={{ position: "relative", zIndex: 1, padding: "100px 24px 108px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ color: "#b7a789", fontSize: 11, letterSpacing: "4px", marginBottom: 18 }}>THE PRINCIPLES OF THIS SPACE</div>
              <h2 style={{ margin: 0, color: "#f3eee5", fontSize: "clamp(27px, 4vw, 40px)", fontWeight: 400 }}>一个不同一点的地方</h2>
              <p style={{ color: "#929592", fontSize: 13, lineHeight: 2, margin: "16px auto 0", maxWidth: 560 }}>
                我们无法承诺世界从此没有偏见，但可以从这里开始，不用偏见给梦想排座次。
              </p>
            </div>
            <div className="dream-principles" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 38 }}>
              {principles.map((item) => (
                <article key={item.number} className="dream-principle">
                  <div style={{ color: "#b7a789", fontSize: 11, letterSpacing: "2px", marginBottom: 22 }}>{item.number}</div>
                  <h3 style={{ margin: "0 0 14px", color: "#e9e1d3", fontSize: 20, fontWeight: 400 }}>{item.title}</h3>
                  <p style={{ margin: 0, color: "#929592", fontSize: 13, lineHeight: 2.1 }}>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="dream-section" style={{ position: "relative", zIndex: 1, padding: "86px 24px 92px", borderTop: "1px solid rgba(220,207,184,.09)", borderBottom: "1px solid rgba(220,207,184,.09)", background: "rgba(255,255,255,.018)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <div style={{ color: "#b7a789", fontSize: 11, letterSpacing: "4px", marginBottom: 22 }}>A DIFFERENT ROLE FOR AI</div>
            <h2 style={{ margin: "0 0 24px", color: "#eee8dc", fontSize: "clamp(25px, 3.6vw, 38px)", lineHeight: 1.6, fontWeight: 400 }}>
              AI 不替你决定人生。
              <br />
              它应该帮助每个人被认真对待。
            </h2>
            <p style={{ margin: 0, color: "#999b99", fontSize: 14, lineHeight: 2.25 }}>
              它可以倾听、理解、整理想法，也可以帮你寻找实现愿望的路径。
              <br />
              但它不应该因为你的身份而轻视你，也不应该替你决定什么才算成功。
              <br />
              它的判断应该能够被解释、被质疑、被纠正。
            </p>
            <p style={{ margin: "30px 0 0", color: "#d4c2a3", fontSize: 15, lineHeight: 2 }}>
              技术不该成为新的高墙。
              <br />
              它应该让更多人拥有曾经遥不可及的可能。
            </p>
          </div>
        </section>

        <section id="write-dream" className="dream-section" style={{ position: "relative", zIndex: 1, padding: "104px 24px 112px", scrollMarginTop: 20 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 38 }}>
              <div style={{ color: "#b7a789", fontSize: 11, letterSpacing: "4px", marginBottom: 18 }}>YOUR DREAM, YOUR SPACE</div>
              <h2 style={{ margin: 0, color: "#f3eee5", fontSize: "clamp(27px, 4vw, 40px)", fontWeight: 400 }}>如果可以，你想做什么？</h2>
              <p style={{ color: "#929592", fontSize: 13, lineHeight: 2, marginTop: 16 }}>不用想得很完整。先写下一句话也可以。</p>
            </div>
            <div className="dream-editor" style={{ padding: "28px 30px 24px", border: "1px solid rgba(210,190,156,.22)", borderRadius: 16, background: "rgba(255,255,255,.035)", boxShadow: "0 20px 80px rgba(0,0,0,.16)" }}>
              <Input.TextArea
                className="dream-input"
                value={dream}
                onChange={(event) => setDream(event.target.value)}
                placeholder="如果不用考虑钱、身份，或别人的眼光……"
                aria-label="写下你真正想做的事"
                autoSize={{ minRows: 4, maxRows: 7 }}
                bordered={false}
                maxLength={1000}
                style={{ padding: 0, color: "#f3eee5", fontSize: 16, lineHeight: 2, resize: "none" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(210,190,156,.13)", gap: 12, flexWrap: "wrap" }}>
                <span style={{ color: "#777e7e", fontSize: 11 }}>不必伟大，不必合理，不必向谁解释。</span>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
                  <span aria-live="polite" style={{ color: "#777e7e", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{dream.length}/1000</span>
                  <Button className="dream-cta" onClick={startWriting} type="primary" style={{ height: 42, padding: "0 20px", border: 0, borderRadius: 8, background: "#c9b48f", color: "#1a1d20", fontWeight: 600, boxShadow: "none" }}>
                    {trimmedDream ? "带着这个梦想继续" : "从一个问题开始"} <ArrowRightOutlined />
                  </Button>
                </div>
              </div>
            </div>
            <p style={{ margin: "16px 0 0", textAlign: "center", color: "#747b7c", fontSize: 11, lineHeight: 1.9 }}>
              点击后会先带你进入工作台，内容会放在输入框里；你可以继续修改，再决定是否发送。
            </p>
            <div style={{ marginTop: 24, textAlign: "center", color: "#747b7c", fontSize: 12, lineHeight: 2 }}>
              <HeartOutlined style={{ color: "#b7a789", marginRight: 8 }} />
              你的梦想不需要通过比较，来证明它值得存在。
            </div>
          </div>
        </section>

        <footer className="dream-section" style={{ position: "relative", zIndex: 1, padding: "30px 24px 42px", borderTop: "1px solid rgba(220,207,184,.09)", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#d4c2a3", fontSize: 15, lineHeight: 2, letterSpacing: "1px" }}>
            愿每一个人，都有不必向世界证明的梦想。
          </p>
          <p style={{ margin: "12px 0 0", color: "#6f7778", fontSize: 10, letterSpacing: "2px" }}>A PLACE WHERE EVERY DREAM CAN BE HEARD</p>
        </footer>
      </div>
    </main>
  );
};

export default HomePage;
