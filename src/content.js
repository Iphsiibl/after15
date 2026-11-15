/* ===========================================================
 * content.js —— 《下班后的十五分钟》的全部文案与场景美术
 * 所有插画均为内联 SVG（无位图素材），色调随站点推进从黄昏走到深夜。
 * =========================================================== */
(function (global) {
  'use strict';

  /* ---------------- 场景插画 ---------------- */

  const SCENES = {
    office: `
<svg viewBox="0 0 400 240" class="scene" aria-hidden="true">
  <defs>
    <linearGradient id="g-office" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--s-a)"/><stop offset="1" stop-color="var(--s-b)"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="42%">
      <stop offset="0" stop-color="var(--glow)" stop-opacity=".55"/>
      <stop offset="1" stop-color="var(--glow)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="240" fill="url(#g-office)"/>
  <rect width="400" height="240" fill="url(#glow)"/>
  <g class="win">
    <rect x="28" y="34" width="70" height="86" rx="6" fill="var(--s-c)" opacity=".55"/>
    <line x1="28" y1="66" x2="98" y2="66" stroke="var(--s-d)" stroke-width="2" opacity=".5"/>
    <line x1="28" y1="86" x2="98" y2="86" stroke="var(--s-d)" stroke-width="2" opacity=".35"/>
  </g>
  <rect x="0" y="150" width="400" height="6" rx="3" fill="var(--s-c)" opacity=".8"/>
  <g class="monitor">
    <rect x="130" y="56" width="150" height="86" rx="9" fill="var(--panel)"/>
    <rect x="136" y="62" width="138" height="74" rx="5" fill="var(--screen)"/>
    <g class="screen-lines" opacity=".5">
      <rect x="146" y="74" width="86" height="6" rx="3" fill="var(--screen-line)"/>
      <rect x="146" y="88" width="118" height="6" rx="3" fill="var(--screen-line)"/>
      <rect x="146" y="102" width="64" height="6" rx="3" fill="var(--screen-line)"/>
      <rect x="146" y="116" width="98" height="6" rx="3" fill="var(--screen-line)"/>
    </g>
    <rect x="196" y="142" width="18" height="10" fill="var(--panel)"/>
    <rect x="172" y="150" width="66" height="7" rx="3.5" fill="var(--panel)"/>
  </g>
  <g class="mug">
    <rect x="304" y="112" width="26" height="38" rx="5" fill="var(--s-d)" opacity=".85"/>
    <path d="M330 122 q10 0 10 9 q0 9 -10 9" stroke="var(--s-d)" stroke-width="3" fill="none" opacity=".85"/>
    <path class="steam" d="M311 106 q5 -8 0 -16 M321 104 q5 -9 0 -17" stroke="var(--s-d)" stroke-width="2" fill="none" opacity=".55"/>
  </g>
  <g class="keyboard"><rect x="120" y="162" width="170" height="16" rx="4" fill="var(--panel)" opacity=".9"/></g>
</svg>`,

    elevator: `
<svg viewBox="0 0 400 240" class="scene" aria-hidden="true">
  <defs>
    <linearGradient id="g-elev" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--s-a)"/><stop offset="1" stop-color="var(--s-b)"/>
    </linearGradient>
  </defs>
  <rect width="400" height="240" fill="url(#g-elev)"/>
  <rect x="20" y="26" width="360" height="188" rx="14" fill="var(--panel)" opacity=".35"/>
  <g class="lift-door">
    <rect x="96" y="26" width="208" height="176" rx="6" fill="var(--s-c)" opacity=".9"/>
    <line x1="200" y1="26" x2="200" y2="202" stroke="var(--s-d)" stroke-width="3" opacity=".7"/>
  </g>
  <g class="figure" opacity=".85">
    <circle cx="200" cy="96" r="15" fill="var(--ink)"/>
    <path d="M186 202 q14 -60 14 -60 q0 0 14 60 z" fill="var(--ink)"/>
  </g>
  <g class="floor-panel">
    <rect x="326" y="34" width="46" height="34" rx="6" fill="var(--panel)"/>
    <text x="349" y="58" text-anchor="middle" class="floor-num">3</text>
  </g>
  <g class="btn" transform="translate(58,60)">
    <circle cx="0" cy="0" r="12" fill="var(--s-d)" opacity=".5"/>
    <circle cx="0" cy="46" r="12" fill="var(--s-d)" opacity=".5"/>
  </g>
</svg>`,

    dusk: `
<svg viewBox="0 0 300 380" class="lobby-art" aria-hidden="true">
  <defs>
    <linearGradient id="g-dusk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#241c46"/>
      <stop offset="0.42" stop-color="#5d3a63"/>
      <stop offset="0.78" stop-color="#c96f6b"/>
      <stop offset="1" stop-color="#ffb877"/>
    </linearGradient>
    <radialGradient id="g-sun2" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff0cf"/>
      <stop offset="0.45" stop-color="#ffca8a"/>
      <stop offset="1" stop-color="#ff9a6b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="g-city2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2150"/>
      <stop offset="1" stop-color="#151130"/>
    </linearGradient>
  </defs>
  <rect width="300" height="380" fill="url(#g-dusk)"/>
  <g fill="#fff">
    <circle cx="46" cy="38" r="1.6" opacity=".9"/><circle cx="120" cy="22" r="1.2" opacity=".7"/>
    <circle cx="212" cy="46" r="1.8" opacity=".85"/><circle cx="268" cy="30" r="1.1" opacity=".6"/>
    <circle cx="82" cy="70" r="1" opacity=".55"/><circle cx="176" cy="84" r="1.3" opacity=".7"/>
    <circle cx="150" cy="120" r="1" opacity=".45"/>
  </g>
  <path d="M252 62 a20 20 0 1 0 13 36 a16 16 0 1 1 -13 -36 z" fill="#ffe9c2" opacity=".8"/>
  <circle cx="104" cy="252" r="88" fill="url(#g-sun2)"/>
  <circle cx="104" cy="252" r="34" fill="#ffd9a6" opacity=".92"/>
  <path d="M0 270 L54 238 L96 264 L140 230 L188 260 L232 234 L300 270 L300 302 L0 302 Z" fill="#3a2a55" opacity=".82"/>
  <g fill="url(#g-city2)">
    <rect x="8" y="288" width="34" height="92" rx="2"/>
    <rect x="50" y="270" width="26" height="110" rx="2"/>
    <rect x="84" y="298" width="40" height="82" rx="2"/>
    <rect x="132" y="278" width="28" height="102" rx="2"/>
    <rect x="168" y="294" width="36" height="86" rx="2"/>
    <rect x="212" y="264" width="24" height="116" rx="2"/>
    <rect x="244" y="286" width="46" height="94" rx="2"/>
  </g>
  <g fill="#ffcf92" opacity=".85">
    <rect x="58" y="284" width="5" height="7"/><rect x="58" y="302" width="5" height="7"/>
    <rect x="140" y="292" width="5" height="7"/><rect x="218" y="280" width="5" height="7"/>
    <rect x="252" y="302" width="5" height="7"/><rect x="94" y="310" width="5" height="7"/>
    <rect x="176" y="312" width="5" height="7"/><rect x="20" y="302" width="5" height="7"/>
  </g>
  <rect x="10" y="10" width="280" height="360" rx="10" fill="none" stroke="rgba(255,255,255,.20)" stroke-width="5"/>
  <line x1="150" y1="10" x2="150" y2="370" stroke="rgba(255,255,255,.14)" stroke-width="4"/>
  <line x1="10" y1="190" x2="290" y2="190" stroke="rgba(255,255,255,.14)" stroke-width="4"/>
</svg>`,

    commute: `
<svg viewBox="0 0 400 240" class="scene" aria-hidden="true">
  <defs>
    <linearGradient id="g-comm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--s-a)"/><stop offset="1" stop-color="var(--s-b)"/>
    </linearGradient>
    <clipPath id="win"><rect x="36" y="34" width="328" height="150" rx="26"/></clipPath>
  </defs>
  <rect width="400" height="240" fill="url(#g-comm)"/>
  <g clip-path="url(#win)">
    <rect x="36" y="34" width="328" height="150" fill="var(--s-c)"/>
    <g class="scroll" fill="var(--s-d)" opacity=".65">
      <rect x="-60" y="52" width="120" height="60" rx="6"/>
      <rect x="120" y="44" width="90" height="78" rx="6"/>
      <rect x="290" y="58" width="140" height="54" rx="6"/>
      <rect x="40" y="128" width="180" height="40" rx="6"/>
      <rect x="270" y="120" width="160" height="48" rx="6"/>
    </g>
    <g class="stars" fill="var(--star)" opacity=".9">
      <circle cx="110" cy="60" r="2.4"/><circle cx="168" cy="86" r="1.8"/>
      <circle cx="252" cy="54" r="2.1"/><circle cx="310" cy="96" r="1.7"/>
      <circle cx="200" cy="120" r="1.6"/>
    </g>
  </g>
  <rect x="36" y="34" width="328" height="150" rx="26" fill="none" stroke="var(--s-d)" stroke-width="5" opacity=".8"/>
  <rect x="150" y="196" width="100" height="16" rx="8" fill="var(--panel)"/>
  <g class="hand" opacity=".8"><rect x="222" y="188" width="46" height="16" rx="8" fill="var(--ink)" opacity=".55"/></g>
</svg>`,

    store: `
<svg viewBox="0 0 400 240" class="scene" aria-hidden="true">
  <defs>
    <linearGradient id="g-store" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--s-a)"/><stop offset="1" stop-color="var(--s-b)"/>
    </linearGradient>
    <linearGradient id="steam2" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="var(--warm)" stop-opacity=".85"/>
      <stop offset="1" stop-color="var(--warm)" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="400" height="240" fill="url(#g-store)"/>
  <rect x="20" y="30" width="150" height="120" rx="8" fill="var(--s-c)" opacity=".75"/>
  <g class="shelf" opacity=".8">
    <line x1="20" y1="70" x2="170" y2="70" stroke="var(--s-d)" stroke-width="3"/>
    <line x1="20" y1="110" x2="170" y2="110" stroke="var(--s-d)" stroke-width="3"/>
    <g fill="var(--s-d)" opacity=".6">
      <rect x="30" y="44" width="14" height="24" rx="3"/><rect x="50" y="40" width="14" height="28" rx="3"/>
      <rect x="70" y="46" width="14" height="22" rx="3"/><rect x="90" y="42" width="14" height="26" rx="3"/>
      <rect x="116" y="48" width="14" height="20" rx="3"/><rect x="138" y="44" width="14" height="24" rx="3"/>
      <rect x="34" y="86" width="14" height="22" rx="3"/><rect x="56" y="82" width="14" height="26" rx="3"/>
      <rect x="78" y="88" width="14" height="20" rx="3"/><rect x="100" y="84" width="14" height="24" rx="3"/>
    </g>
  </g>
  <g class="pot">
    <rect x="214" y="120" width="120" height="56" rx="10" fill="var(--panel)"/>
    <rect x="222" y="112" width="104" height="14" rx="7" fill="var(--warm)" opacity=".55"/>
    <g class="steam" stroke="url(#steam2)" stroke-width="7" fill="none" stroke-linecap="round">
      <path d="M244 108 q-8 -18 2 -32"/><path d="M270 106 q8 -20 -2 -34"/><path d="M296 108 q-8 -18 2 -32"/>
    </g>
  </g>
  <g class="cup" transform="translate(300,150)">
    <path d="M0 0 h44 l-7 44 a8 8 0 0 1 -8 7 h-14 a8 8 0 0 1 -8 -7 z" fill="var(--warm)"/>
    <rect x="0" y="-6" width="44" height="10" rx="5" fill="var(--warm)" opacity=".9"/>
    <g class="cup-steam" stroke="var(--warm)" stroke-width="4" fill="none" opacity=".7" stroke-linecap="round">
      <path d="M14 -14 q6 -12 0 -22"/><path d="M28 -16 q-6 -12 0 -22"/>
    </g>
  </g>
</svg>`,

    street: `
<svg viewBox="0 0 400 240" class="scene" aria-hidden="true">
  <defs>
    <linearGradient id="g-street" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--s-a)"/><stop offset="1" stop-color="var(--s-b)"/>
    </linearGradient>
    <radialGradient id="lamp" cx="50%" cy="30%" r="60%">
      <stop offset="0" stop-color="var(--warm)" stop-opacity=".8"/>
      <stop offset="1" stop-color="var(--warm)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="240" fill="url(#g-street)"/>
  <g class="bldg" fill="var(--s-c)" opacity=".8">
    <rect x="18" y="60" width="72" height="140" rx="4"/>
    <rect x="96" y="92" width="58" height="108" rx="4"/>
    <rect x="262" y="74" width="64" height="126" rx="4"/>
    <rect x="332" y="104" width="52" height="96" rx="4"/>
  </g>
  <g class="windows" fill="var(--warm)" opacity=".55">
    <rect x="30" y="76" width="12" height="16" rx="2"/><rect x="52" y="76" width="12" height="16" rx="2"/>
    <rect x="30" y="106" width="12" height="16" rx="2"/><rect x="70" y="106" width="12" height="16" rx="2"/>
    <rect x="276" y="92" width="12" height="16" rx="2"/><rect x="300" y="92" width="12" height="16" rx="2"/>
    <rect x="276" y="124" width="12" height="16" rx="2"/>
  </g>
  <g class="streetlight">
    <rect x="186" y="60" width="6" height="140" fill="var(--ink)" opacity=".8"/>
    <path d="M189 62 q0 -18 22 -18" stroke="var(--ink)" stroke-width="6" fill="none" opacity=".8"/>
    <circle class="bulb" cx="214" cy="46" r="7" fill="var(--warm)"/>
    <circle class="halo" cx="214" cy="46" r="54" fill="url(#lamp)"/>
  </g>
  <g class="tree" opacity=".7" fill="var(--ink)">
    <rect x="236" y="150" width="7" height="50" rx="3"/>
    <circle cx="239" cy="140" r="26"/>
  </g>
  <g class="dog" transform="translate(60,186)" opacity=".85" fill="var(--ink)">
    <ellipse cx="22" cy="18" rx="20" ry="11"/>
    <circle cx="42" cy="8" r="9"/>
    <rect x="6" y="24" width="4" height="12" rx="2"/><rect x="26" y="24" width="4" height="12" rx="2"/>
  </g>
</svg>`,

    bed: `
<svg viewBox="0 0 400 240" class="scene" aria-hidden="true">
  <defs>
    <linearGradient id="g-bed" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--s-a)"/><stop offset="1" stop-color="var(--s-b)"/>
    </linearGradient>
    <radialGradient id="night" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="var(--warm)" stop-opacity=".5"/>
      <stop offset="1" stop-color="var(--warm)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="240" fill="url(#g-bed)"/>
  <g class="stars" fill="var(--star)" opacity=".85">
    <circle cx="60" cy="40" r="2"/><circle cx="120" cy="70" r="1.6"/><circle cx="200" cy="34" r="2.2"/>
    <circle cx="268" cy="66" r="1.7"/><circle cx="330" cy="38" r="2"/><circle cx="356" cy="92" r="1.5"/>
    <circle cx="90" cy="104" r="1.4"/>
  </g>
  <circle class="moon-glow" cx="330" cy="52" r="70" fill="url(#night)"/>
  <g class="bed">
    <rect x="40" y="150" width="320" height="60" rx="16" fill="var(--panel)"/>
    <path class="quilt" d="M60 178 q60 -34 130 -22 q90 14 170 -6 v60 h-300 z" fill="var(--quilt)"/>
    <path class="quilt-line" d="M100 168 q40 -18 90 -12" stroke="var(--ink)" stroke-width="3" fill="none" opacity=".25"/>
    <g class="pillow"><rect x="58" y="140" width="86" height="34" rx="17" fill="var(--pillow)"/></g>
  </g>
  <g class="lamp" transform="translate(318,116)">
    <rect x="-3" y="10" width="6" height="46" fill="var(--panel)"/>
    <path d="M-16 10 q16 -26 32 0 z" fill="var(--warm)" opacity=".9"/>
  </g>
</svg>`,
  };

  /* ---------------- 插画的无障碍描述 ---------------- */
  const SCENE_ALT = {
    dusk: '黄昏的窗景：天空由橘黄渐变成紫蓝，一弯月亮挂在城市剪影上方，远处有几扇窗亮着灯。',
    office: '办公桌一角：还亮着的显示器、冒着热气的马克杯和键盘，旁边是一扇黄昏的窗。',
    elevator: '电梯轿厢内部：一扇关着的电梯门，门上有个模糊的人影，右上角显示楼层 3，旁边是两个圆形按钮。',
    commute: '傍晚的车窗：窗外流动的城市灯光和几点星光，路边是一只搭在窗沿上的手。',
    store: '便利店的灯光：两排货架、一锅冒着热气的关东煮，还有一杯刚买的热饮。',
    street: '小区楼下：一盏亮着的路灯、几栋亮着窗的楼、一棵树，还有一只从旁边走过的狗。',
    bed: '深夜的被窝：床头一盏小夜灯，被子和枕头，窗外是一弯月亮和几点星星。',
  };

  /* ---------------- 每日一签（按日期固定） ---------------- */
  const DAILY_SIGNS = [
    '今天也辛苦了。这四个字你值得听。',
    '你不需要一直有产出，人不是机器。',
    '慢一点也可以，掉队的是世界不是你。',
    '今天能好好吃饭，就是了不起的一天。',
    '你已经比昨天多撑了一天，这本身就很酷。',
    '难过是真的，撑过来也是真的。',
    '今天没做成的事，明天再说。',
    '你已经很好了，标准不该只有你自己定。',
    '慢热的人不算迟到的人。',
    '有人正在因为你的存在而好过一点。',
    '休息不是奖励，是你应得的。',
    '你不是效率低，你只是累了。',
  ];

  /* ---------------- 旅程 ---------------- */
  const STAGES = [
    {
      id: 'office',
      name: '关电脑',
      time: '18:47',
      scene: 'office',
      palette: { a: '#3b2f4f', b: '#7a4a44', c: '#2a2136', d: '#f0c9a4', glow: '#ffb56b' },
      bed: 'room',
      narration: [
        '18:47。',
        '屏幕还亮着，你的右半边灵魂已经走了，左半边还在跟最后一个表格搏斗。',
      ],
      action: { label: '点一下屏幕，把它关掉', hint: '点了就不许再打开', kind: 'screen', success: '屏幕暗了。办公室的声音一下子少了一层。' },
      options: [
        {
          label: '立刻关机，不留后路',
          reply: ['啪。', '你没等它保存。', '但那不重要——重要的事不会因为这一个文件消失，而你的晚饭凉了。'],
          delta: 3, tag: '干脆利落的告别',
        },
        {
          label: '温柔保存，假装负责',
          reply: ['你按了 Ctrl+S，又按了一次。', '电脑很感动，你的领导不会知道。', '但那个文件，是你今天最后一件不属于工作的事。'],
          delta: 1, tag: '体面地交接今天',
        },
        {
          label: '直接拔电源',
          reply: ['你拔了。', '三秒后你想起还有份周报没发。', '但那也是三秒前的你干的。现在的你，下班了。'],
          delta: 0, tag: '江湖气',
        },
      ],
    },
    {
      id: 'elevator',
      name: '等电梯',
      time: '18:56',
      scene: 'elevator',
      palette: { a: '#2f3350', b: '#4b4a6b', c: '#22243c', d: '#cfe0ff', glow: '#9bb8ff' },
      bed: 'room',
      narration: [
        '你走向电梯。电梯在 3 楼。',
        '你们之间隔着四层楼的时间，和一个不该遇见的人。',
      ],
      action: { label: '按住电梯按钮，等它来', hint: '按住不放，松手就算输', kind: 'hold', success: '门开了。这四十秒电梯，是今天最短也最安静的一段路。' },
      options: [
        {
          label: '电梯门开了，里面是同事',
          reply: ['「你还没走啊？」', '这句话在电梯里的杀伤力，约等于把周末取消了一次。', '你挤出一个「马上走马上走」，然后用最快的手速按了关门。'],
          delta: -2, tag: '社交电量告急',
        },
        {
          label: '电梯门开了，里面是领导',
          reply: ['领导在电梯里说了句「最近辛苦了」，语气是关心，他说完就上楼了。', '你连「不辛苦」都没敢说出口，只剩下点头的力气。'],
          delta: -3, tag: '不敢喘气的四层楼',
        },
        {
          label: '电梯里没人',
          reply: ['没有人。门合上，空调声忽然变大。', '这是今天属于你的四十秒——不用回消息，不用假笑，不用假装自己也还精神着。'],
          delta: 4, tag: '一个人的电梯',
        },
      ],
    },
    {
      id: 'commute',
      name: '在路上',
      time: '19:12',
      scene: 'commute',
      palette: { a: '#252b46', b: '#3c4467', c: '#1b2036', d: '#ffd79a', glow: '#ffca7a' },
      bed: 'wind',
      narration: [
        '路上。',
        '你掏出手机，或者不掏。',
      ],
      action: { label: '滑动车窗，看看外面', hint: '往左右拖一下', kind: 'drag', success: '窗外的高楼慢慢退后了。你今天其实走了很远的路。' },
      options: [
        {
          label: '刷短视频，刷到忘了要去哪',
          reply: ['十五分钟过去了，你到了一个从没去过的站。', '但今天的累，确实被盖过去了一点——这点很重要。'],
          delta: 2, tag: '被短视频接住的一刻',
        },
        {
          label: '听歌，什么都不干',
          reply: ['耳机里的声音替你多活了一会儿。', '你借了别人的情绪，今晚先不用自己出。'],
          delta: 3, tag: '借来的一首歌',
        },
        {
          label: '看着窗外，从写字楼看到居民区',
          reply: ['窗外的高楼慢慢变成了晾衣绳和便利店。', '这是今天唯一不用回消息的十分钟，你没有辜负它。'],
          delta: 5, tag: '看着窗外的那十分钟',
        },
      ],
    },
    {
      id: 'store',
      name: '便利店',
      time: '19:34',
      scene: 'store',
      palette: { a: '#243447', b: '#3f5266', c: '#1b2734', d: '#fff3d6', glow: '#ffe9b0' },
      bed: 'room',
      narration: [
        '便利店。灯光白得像刚下过雪。',
        '关东煮的汤在冒气，收银员在补货。没有人会问你今天过得好吗。',
      ],
      action: { label: '买杯热的，捧一会儿', hint: '点一下杯子', kind: 'cup', success: '掌心慢慢有了温度，肩膀也就跟着松下来了。' },
      options: [
        {
          label: '买一份关东煮',
          reply: ['你选了萝卜、豆腐，和一个你其实不爱吃的海带。', '吃的时候，海带居然还挺好吃。', '有些东西是到了嘴里才变好的。'],
          delta: 3, tag: '关东煮萝卜',
        },
        {
          label: '什么都不买，就站一会儿',
          reply: ['你什么都没买，就站在饮料柜前发了两分钟呆。', '这两分钟你不欠任何人，也不欠任何进度。', '你是自由的，这句话你今天才想起来。'],
          delta: 6, tag: '便利店的两分钟发呆',
        },
        {
          label: '买最便宜的那个',
          reply: ['你挑了最便宜的那个，理由是「没必要」。', '其实你有点想要那个贵的，但算了，人生已经够省了。'],
          delta: 2, tag: '省下来的三块钱',
        },
      ],
    },
    {
      id: 'street',
      name: '楼下',
      time: '20:02',
      scene: 'street',
      palette: { a: '#1b2540', b: '#2c3557', c: '#151c30', d: '#ffe2ab', glow: '#ffc987' },
      bed: 'wind',
      narration: [
        '楼下的灯是感应灯。',
        '你跺一下脚，它就亮了，像有人替你留了一盏。',
      ],
      action: { label: '跺一下脚，叫亮那盏灯', hint: '点一下或者按空格', kind: 'stomp', success: '灯亮了。好像有人在楼上等你，虽然那只是感应灯。' },
      options: [
        {
          label: '直接上楼，开灯',
          reply: ['灯亮了。屋子还是那个屋子。', '但今天它是你要回去的地方，而你也确实回来了。'],
          delta: 3, tag: '回到自己的灯下',
        },
        {
          label: '在楼下坐一会儿',
          reply: ['你在楼下坐了五分钟。', '没刷手机，没看表，只是坐着。有人遛狗经过，狗看了你一眼，走了。', '这个城市里，有人和你共享过同一片安静。'],
          delta: 5, tag: '楼下的五分钟',
        },
        {
          label: '边走边复盘今天',
          reply: ['你在心里给今天打了个分：六十分吧。', '然后你想起，它撑住了你一整天，已经很不容易了。'],
          delta: 2, tag: '六十分的今天',
        },
      ],
    },
    {
      id: 'bed',
      name: '被窝',
      time: '22:41',
      scene: 'bed',
      palette: { a: '#141a33', b: '#232b4d', c: '#0f1428', d: '#cfd8ff', glow: '#8fa6ff' },
      bed: 'rain',
      narration: [
        '你躺下了。',
        '被子凉的那两秒，是今天最诚实的两秒。',
      ],
      action: { label: '把被子拉上来', hint: '点一下被子', kind: 'quilt', success: '被子盖好了。世界暂时和你无关。' },
      options: [
        {
          label: '拉好被子，今天结束了',
          reply: ['好的。今天结束了。', '它没有解决任何问题，但它把你带到了这里，这就已经够了。'],
          delta: 2, tag: '把今天放下',
        },
        {
          label: '再刷五分钟手机',
          reply: ['五分钟。你是这么跟自己说的。', '但你已经很久没有真正想看点什么了——你只是不想让今天结束。', '没关系，让它结束吧。它已经够长了。'],
          delta: -1, tag: '和今天多待五分钟',
        },
        {
          label: '给明天写一句话',
          reply: ['你给明天留了一句话。', '写下来，它就不会被忙乱吃掉了。'],
          delta: 4, tag: '给明天留的一句话', note: true,
        },
      ],
    },
  ];

  /* ---------------- 结算 ---------------- */
  const ENDINGS = {
    low: {
      title: '今天的电量不多了',
      lines: [
        '今天已经很辛苦了。',
        '明天不用更好，能撑住就行。',
        '今天就到这里。晚安。',
      ],
    },
    mid: {
      title: '你把自己带回了家',
      lines: [
        '你今天没有做很多事，但你把自己带回了家。',
        '这件事本身就很了不起。',
        '手机可以先放下了。晚安。',
      ],
    },
    high: {
      title: '今天对你还算温柔',
      lines: [
        '你今天做得比昨天好一点点。',
        '把这份好留一点给明天用。',
        '晚安，明天见。',
      ],
    },
  };

  const TOMORROW = [
    '明天 09:30 有一场会。',
    '但那是明天的事。',
    '现在，请把手机扣过去。',
  ];

  const TIPS = [
    '今天的废话，明天再说也行。',
    '你今天的「下班」，是从谁手里抢回来的？',
    '有些天，活着本身就算完成。',
    '今天你没有对不起任何人，除了你自己——而你原谅了。',
    '下班这件事，不需要谁来批准。',
  ];

  global.CONTENT = { SCENES, STAGES, DAILY_SIGNS, ENDINGS, TOMORROW, TIPS, SCENE_ALT };
})(window);
