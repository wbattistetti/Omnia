Example output:

{
  "label":"Utente maggiorenne",
  "script":"const CONDITION={label:\"Utente maggiorenne\",type:\"predicate\",inputs:[\"agents asks for personal data.Date of Birth\"]};function main(ctx){try{const k=\"agents asks for personal data.Date of Birth\";if(!ctx||!Object.prototype.hasOwnProperty.call(ctx,k))return false;const d=parseDate(ctx[k]);if(!d)return false;const now=new Date();let a=now.getUTCFullYear()-d.getUTCFullYear();const m=now.getUTCMonth()-d.getUTCMonth();if(m<0||(m===0&&now.getUTCDate()<d.getUTCDate()))a--;return a>=18;}catch(e){return false;}}function parseDate(v){if(v instanceof Date&&!Number.isNaN(v.valueOf()))return v;if(typeof v===\"number\"&&Number.isFinite(v))return new Date(v);if(typeof v===\"string\"){const s=v.trim();let m=s.match(/^(\\d{1,2})[\\\/\\\-](\\d{1,2})[\\\/\\\-](\\d{2,4})$/);if(m){let d=parseInt(m[1],10),mo=parseInt(m[2],10)-1,y=parseInt(m[3],10);if(y<100)y+=2000;const dt=new Date(Date.UTC(y,mo,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo&&dt.getUTCDate()===d?dt:null;}m=s.match(/^(\\d{4})[\\\/\\\-](\\d{1,2})[\\\/\\\-](\\d{1,2})$/);if(m){const y=parseInt(m[1],10),mo=parseInt(m[2],10)-1,d=parseInt(m[3],10);const dt=new Date(Date.UTC(y,mo,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo&&dt.getUTCDate()===d?dt:null;}const tt=Date.parse(s);if(!Number.isNaN(tt))return new Date(tt);}return null;}"
}

