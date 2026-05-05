"use client";

import { useEffect } from "react";
import { useEspanolStore } from "./lib/store";
import { T } from "./lib/tokens";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { Talk } from "./components/Talk";
import { Shadow } from "./components/Shadow";
import { Listen } from "./components/Listen";
import { Patterns } from "./components/Patterns";
import { Missions } from "./components/Missions";
import { Vocab } from "./components/Vocab";
import { Photo } from "./components/Photo";
import { Progress } from "./components/Progress";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,500&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  ::-webkit-scrollbar{display:none;}
  html,body{height:100%;overflow:hidden;background:#0F0E0C;}
  button{touch-action:manipulation;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;border:none;background:none;}
  textarea,input{font-family:'Plus Jakarta Sans',sans-serif;}
  textarea{resize:none;}
  textarea:focus,input:focus{outline:none;}
  textarea::placeholder,input::placeholder{color:#3A3835;}
  @keyframes slideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes blink{0%,100%{opacity:.15}50%{opacity:1}}
  @keyframes popIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
  @keyframes recording{0%,100%{box-shadow:0 0 0 0 rgba(201,112,112,.4)}50%{box-shadow:0 0 0 8px rgba(201,112,112,0)}}
  .msg{animation:slideUp .2s cubic-bezier(.2,.8,.2,1);}
  .popIn{animation:popIn .15s ease;}
  .dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:${T.gold};animation:blink 1.3s ease infinite;margin:0 2px;}
  .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
  .press{transition:transform .1s,opacity .1s;}.press:active{transform:scale(.96);opacity:.8;}
  .rec-pulse{animation:recording 1.5s ease infinite;}
  button:disabled{opacity:.25!important;cursor:not-allowed!important;}
`;

export default function EspanolOS() {
  const { tab, mounted, setMounted, loadFromSupabase } = useEspanolStore();

  useEffect(() => {
    loadFromSupabase().then(() => setMounted(true));
    if (typeof window !== "undefined") window.speechSynthesis?.getVoices();
  }, [loadFromSupabase, setMounted]);

  if (!mounted) return <div style={{ height: "100dvh", background: T.bg }} />;

  return (
    <div style={{ height: "100dvh", background: T.bg, color: T.cream, fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: 500, margin: "0 auto" }}>
      <style>{CSS}</style>
      <Header />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "talk" && <Talk />}
        {tab === "shadow" && <Shadow />}
        {tab === "listen" && <Listen />}
        {tab === "patterns" && <Patterns />}
        {tab === "missions" && <Missions />}
        {tab === "vocab" && <Vocab />}
        {tab === "photo" && <Photo />}
        {tab === "progress" && <Progress />}
      </div>
      <BottomNav />
    </div>
  );
}
