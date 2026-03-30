/**
 * Viceroy Email Sequence
 * 3-step drip for private capital participation outreach
 */

export interface EmailSequenceStep {
  step: number;
  subject: string;
  html: (firstName: string, assessmentUrl: string) => string;
  delayDays: number; // days after previous step
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://machinemindconsulting.com';

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Viceroy</title>
</head>
<body style="margin:0;padding:0;background:#06060a;font-family:'Georgia',serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06060a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 32px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:'Arial',sans-serif;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#f0f0f3;font-weight:700;">MACHINEMIND</span>
                  </td>
                  <td align="right">
                    <span style="font-family:'Arial',sans-serif;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a96e;">VICEROY</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 0;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:32px 0 0 0;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="font-family:'Arial',sans-serif;font-size:10px;color:rgba(240,240,243,0.2);line-height:1.8;margin:0;">
                Private contractual participation structure. Not a securities offering. Not financial advice.<br/>
                MachineMind — Private Capital Division<br/>
                <a href="${BASE_URL}/viceroy/unsubscribe?email={{email}}" style="color:rgba(240,240,243,0.2);text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function p(text: string, style = ''): string {
  return `<p style="font-family:'Georgia',serif;font-size:15px;color:rgba(240,240,243,0.75);line-height:1.8;margin:0 0 20px 0;${style}">${text}</p>`;
}

function label(text: string): string {
  return `<p style="font-family:'Arial',sans-serif;font-size:9px;letter-spacing:0.5em;text-transform:uppercase;color:#c9a96e;margin:0 0 16px 0;">${text}</p>`;
}

function h1(text: string): string {
  return `<h1 style="font-family:'Georgia',serif;font-size:28px;font-weight:400;color:#f0f0f3;line-height:1.3;margin:0 0 24px 0;letter-spacing:-0.02em;">${text}</h1>`;
}

function divider(): string {
  return `<div style="height:1px;background:rgba(255,255,255,0.06);margin:28px 0;"></div>`;
}

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
    <tr>
      <td>
        <a href="${url}" style="display:inline-block;padding:14px 36px;border:1px solid #c9a96e;background:rgba(201,169,110,0.1);color:#f0f0f3;font-family:'Arial',sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function blockquote(text: string): string {
  return `<div style="border-left:2px solid rgba(201,169,110,0.3);padding:16px 20px;margin:24px 0;background:rgba(201,169,110,0.04);">
    <p style="font-family:'Georgia',serif;font-size:14px;font-style:italic;color:rgba(240,240,243,0.5);line-height:1.7;margin:0;">${text}</p>
  </div>`;
}

// ─────────────────────────────────────────────
// STEP 1 — Cold intro
// ─────────────────────────────────────────────
function step1Html(firstName: string, assessmentUrl: string): string {
  const content = `
    ${label('Private Capital Participation')}
    ${h1(`${firstName}, your assets may qualify for a private participation structure.`)}
    ${p('Most capital sits in accounts designed for yesterday\'s economy. CDs at 4.5%. 401(k)s absorbing market volatility. Real estate equity tied to a single address.')}
    ${p('There\'s a different structure. One that doesn\'t require you to hand your capital to a fund manager, accept a lock-up period, or trust a projection.')}
    ${p('It\'s called <strong style="color:#f0f0f3;">private contractual participation</strong> — and it\'s built around one principle: your capital participates in demonstrated operational performance. Not forecasts. Not promises. Performance.')}
    ${divider()}
    ${p('This isn\'t for everyone. The structure works specifically for individuals who:', 'color:rgba(240,240,243,0.5);')}
    <ul style="margin:0 0 20px 0;padding:0 0 0 20px;">
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">Control deployable assets directly ($200K+)</li>
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">Make their own decisions without an advisor\'s approval</li>
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">Evaluate opportunities on results, not narratives</li>
    </ul>
    ${p('If that\'s you — take 60 seconds to determine if there\'s alignment.')}
    ${ctaButton('Take the 60-Second Assessment', assessmentUrl)}
    ${p('No obligation. No sales call scheduled automatically. Just alignment — or the honest conclusion that there isn\'t any.', 'font-size:13px;color:rgba(240,240,243,0.3);')}
  `;
  return emailWrapper(content);
}

// ─────────────────────────────────────────────
// STEP 2 — Follow-up: what this actually is
// ─────────────────────────────────────────────
function step2Html(firstName: string, assessmentUrl: string): string {
  const content = `
    ${label('Following Up')}
    ${h1(`${firstName}, the question most people have is: "What exactly is this?"`)}
    ${p('That\'s the right question. Let me answer it directly.')}
    ${blockquote('"Private contractual participation" means your capital is structured into a private agreement tied to the operating performance of a specific business or asset — not a market index, not a fund\'s discretion, not a projection."')}
    ${p('You don\'t buy stock. You don\'t become a partner. You enter a private contract that defines what happens when the operation performs — and what happens when it doesn\'t.')}
    ${divider()}
    ${p('What it\'s <em style="color:#f0f0f3;">not</em>:', 'color:rgba(240,240,243,0.5);')}
    <ul style="margin:0 0 20px 0;padding:0 0 0 20px;">
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">Not a securities offering (no SEC registration, no prospectus)</li>
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">Not a fund with a manager making decisions on your behalf</li>
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">Not a guaranteed return structure of any kind</li>
    </ul>
    ${p('What it <em style="color:#f0f0f3;">is</em>:', 'color:rgba(240,240,243,0.5);')}
    <ul style="margin:0 0 20px 0;padding:0 0 0 20px;">
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">A private agreement between two parties</li>
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">Tied to real operational metrics</li>
      <li style="font-family:'Georgia',serif;font-size:14px;color:rgba(240,240,243,0.5);line-height:1.8;margin-bottom:8px;">Structured by individuals who control their own assets</li>
    </ul>
    ${divider()}
    ${p('The 60-second assessment determines whether your specific situation has structural alignment. That\'s the only way to know.')}
    ${ctaButton('Determine Alignment', assessmentUrl)}
  `;
  return emailWrapper(content);
}

// ─────────────────────────────────────────────
// STEP 3 — Final: last call
// ─────────────────────────────────────────────
function step3Html(firstName: string, assessmentUrl: string): string {
  const content = `
    ${label('Final Note')}
    ${h1(`${firstName}, this is the last time I'll send this.`)}
    ${p('The participation structure isn\'t for everyone, and I don\'t follow up indefinitely. If the timing isn\'t right, that\'s a legitimate answer — and there\'s no pressure here.')}
    ${p('But if you\'ve been sitting on capital that isn\'t doing what you\'d like it to do — CDs earning below-market rates, equity locked in a property you\'re holding but not leveraging, retirement accounts riding a market you don\'t fully control — the structure I\'ve described may be worth 60 seconds of your consideration.')}
    ${blockquote('The individuals who move forward with Viceroy participation share one trait: they make decisions based on structure, not stories. If that\'s you, the assessment is the first step.')}
    ${p('If not — no problem. I\'ll remove you from future correspondence.')}
    ${ctaButton('Complete the 60-Second Assessment', assessmentUrl)}
    ${divider()}
    ${p('Either way — thank you for reading.', 'font-size:13px;color:rgba(240,240,243,0.3);')}
  `;
  return emailWrapper(content);
}

// ─────────────────────────────────────────────
// SEQUENCE DEFINITION
// ─────────────────────────────────────────────
export const VICEROY_SEQUENCE: EmailSequenceStep[] = [
  {
    step: 1,
    subject: 'Your assets may qualify for a private participation structure',
    html: step1Html,
    delayDays: 0,
  },
  {
    step: 2,
    subject: 'What private contractual participation actually means',
    html: step2Html,
    delayDays: 3,
  },
  {
    step: 3,
    subject: 'Last note — Viceroy participation',
    html: step3Html,
    delayDays: 5,
  },
];

export function getSequenceStep(step: number): EmailSequenceStep | undefined {
  return VICEROY_SEQUENCE.find((s) => s.step === step);
}
