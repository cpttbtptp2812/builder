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
      ? `我想认真写下一个纯粹属于自己的梦想：${trimmedDream}。请陪我把它记录下来，不要急着评价它是否现实、是否有用，也不要把它变成赚钱或成功的计划。`
      : "我想认真写下一个纯粹属于自己的梦想。请先问我：如果人生不再为钱发愁，我最想做什么？不要评价它是否现实或有用。";

    // 只把内容带入工作台输入框，不自动发送，让用户保留最后的决定权。
    if (onEnterWorkbenchWithPrompt) {
      onEnterWorkbenchWithPrompt(prompt, false);
    } else {
      onEnterWorkbench();
    }
  };

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
        .dream-input.ant-input,
        .dream-input .ant-input {
          background:transparent !important;
          color:#f3eee5 !important;
          border:0 !important;
          box-shadow:none !important;
        }
        .dream-input.ant-input::placeholder,
        .dream-input .ant-input::placeholder { color:#888b8d !important; }
        @media (max-width: 640px) {
          .dream-hero-title { font-size:clamp(38px, 12vw, 58px) !important; }
          .dream-section { padding-left:22px !important; padding-right:22px !important; }
          .dream-orbit { width:220px !important; height:220px !important; }
        }
      `}</style>

      <div className="dream-home" style={{ position: "relative", minHeight: "100%", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 22%, rgba(116,103,83,.20), transparent 48%), linear-gradient(180deg,#10151b 0%,#151b21 58%,#10151b 100%)" }} />
        {[
          ["12%", "17%"], ["22%", "31%"], ["79%", "14%"], ["87%", "34%"], ["68%", "8%"], ["8%", "48%"], ["92%", "58%"], ["31%", "9%"], ["73%", "43%"], ["17%", "66%"]
        ].map(([left, top], index) => (
          <span key={index} className="dream-star" style={{ left, top }} />
        ))}

        <header className="dream-section" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "28px 42px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, letterSpacing: "3px", fontSize: 12, color: "#d8c6a6", fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9b48f", boxShadow: "0 0 12px #c9b48f" }} />
            A PLACE FOR YOUR DREAM
          </div>
          <span style={{ color: "#85898b", fontSize: 12, letterSpacing: "1px" }}>留给自己的空间</span>
        </header>

        <section className="dream-section" style={{ position: "relative", zIndex: 1, minHeight: "min(720px, calc(100vh - 80px))", padding: "70px 24px 92px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div className="dream-orbit" style={{ position: "absolute", width: 310, height: 310, top: "50%", left: "50%", transform: "translate(-50%,-55%)", borderRadius: "50%", border: "1px solid rgba(207,185,146,.12)", boxShadow: "0 0 90px rgba(190,164,120,.08), inset 0 0 70px rgba(190,164,120,.04)", pointerEvents: "none" }}>
            <div style={{ position: "absolute", width: 9, height: 9, borderRadius: "50%", background: "#d7c29e", top: 34, right: 48, boxShadow: "0 0 22px 5px rgba(215,194,158,.28)" }} />
          </div>
          <div style={{ position: "relative", width: 54, height: 54, marginBottom: 34, borderRadius: "50%", background: "linear-gradient(145deg,#e6d6b7,#9f8c6b)", boxShadow: "0 0 55px rgba(215,194,158,.18)" }}>
            <div style={{ position: "absolute", width: 48, height: 48, borderRadius: "50%", background: "#151b21", top: -7, left: 15 }} />
          </div>
          <div style={{ position: "relative", color: "#b7a789", fontSize: 11, letterSpacing: "5px", marginBottom: 28 }}>A QUESTION FOR YOURSELF</div>
          <h1 className="dream-hero-title" style={{ position: "relative", margin: 0, color: "#f3eee5", fontSize: "clamp(42px, 6.2vw, 76px)", lineHeight: 1.38, fontWeight: 400, letterSpacing: "2px" }}>
            如果你的人生
            <br />
            不再为钱发愁，
            <br />
            <span style={{ color: "#d5bd94" }}>你会做什么？</span>
          </h1>
          <p style={{ position: "relative", margin: "28px 0 0", color: "#a9a9a4", fontSize: 15, lineHeight: 2.1, letterSpacing: "1px" }}>
            不为了赚钱，不为了成功，不为了证明自己。
            <br />
            只是因为喜欢，只是因为想做，只是因为那是你的愿望。
          </p>
          <a href="#write-dream" className="dream-link" style={{ position: "relative", marginTop: 54, display: "inline-flex", alignItems: "center", gap: 12, fontSize: 13, letterSpacing: "2px" }}>
            写下那个一直藏在心里的梦想 <ArrowDownOutlined />
          </a>
        </section>

        <section className="dream-section" style={{ position: "relative", zIndex: 1, padding: "88px 24px 100px", borderTop: "1px solid rgba(220,207,184,.09)", borderBottom: "1px solid rgba(220,207,184,.09)", background: "rgba(255,255,255,.018)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <div style={{ color: "#b7a789", fontSize: 11, letterSpacing: "4px", marginBottom: 24 }}>A DREAM DOESN'T NEED A REASON</div>
            <h2 style={{ margin: "0 0 24px", color: "#eee8dc", fontSize: "clamp(25px, 3.6vw, 38px)", lineHeight: 1.6, fontWeight: 400 }}>
              不是每一个梦想，
              <br />
              都需要一个有用的理由。
            </h2>
            <p style={{ margin: 0, color: "#999b99", fontSize: 14, lineHeight: 2.2 }}>
              也许你想环游世界，也许你想开一家小小的书店，
              <br />
              也许你想写一本没人读过的书，或者只是想看一次极光。
              <br />
              它可以很大，也可以很小。可以不切实际，也可以永远不被实现。
            </p>
            <p style={{ margin: "30px 0 0", color: "#d4c2a3", fontSize: 16, letterSpacing: "1px" }}>
              它只需要对你有意义。
            </p>
          </div>
        </section>

        <section id="write-dream" className="dream-section" style={{ position: "relative", zIndex: 1, padding: "100px 24px 112px", scrollMarginTop: 20 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 38 }}>
              <div style={{ color: "#b7a789", fontSize: 11, letterSpacing: "4px", marginBottom: 18 }}>YOUR DREAM, YOUR SPACE</div>
              <h2 style={{ margin: 0, color: "#f3eee5", fontSize: "clamp(27px, 4vw, 40px)", fontWeight: 400 }}>如果可以，你想做什么？</h2>
              <p style={{ color: "#929592", fontSize: 13, lineHeight: 2, marginTop: 16 }}>不用想得很完整。先写下一句话也可以。</p>
            </div>
            <div style={{ padding: "28px 30px 24px", border: "1px solid rgba(210,190,156,.22)", borderRadius: 16, background: "rgba(255,255,255,.035)", boxShadow: "0 20px 80px rgba(0,0,0,.16)" }}>
              <Input.TextArea
                className="dream-input"
                value={dream}
                onChange={(event) => setDream(event.target.value)}
                placeholder="如果不用考虑钱、时间，或别人的眼光……"
                aria-label="写下你真正想做的事"
                autoSize={{ minRows: 4, maxRows: 7 }}
                bordered={false}
                maxLength={1000}
                style={{ padding: 0, color: "#f3eee5", fontSize: 16, lineHeight: 2, resize: "none" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(210,190,156,.13)", gap: 12 }}>
                <span style={{ color: "#777e7e", fontSize: 11 }}>不必伟大，不必合理，不必向谁解释。</span>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
            <div style={{ marginTop: 22, textAlign: "center", color: "#747b7c", fontSize: 12, lineHeight: 2 }}>
              <HeartOutlined style={{ color: "#b7a789", marginRight: 8 }} />
              这里不比较梦想的大小，也不衡量它是否值得。
            </div>
          </div>
        </section>

        <footer className="dream-section" style={{ position: "relative", zIndex: 1, padding: "26px 24px 34px", borderTop: "1px solid rgba(220,207,184,.09)", textAlign: "center", color: "#6f7778", fontSize: 11, letterSpacing: "1px" }}>
          愿你始终拥有一个，不必向世界证明的梦想。
        </footer>
      </div>
    </main>
  );
};

export default HomePage;
