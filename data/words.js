/* ============================================================
 * 词库 · 人教版 PEP 小学英语（三年级起点）四年级 上/下册
 * 选词原则：语义具体、有画面、可用图形表征；剔除 or/her/his 等
 * 纯语法词（拼写检索无意义）。
 * 字段:
 *   w     单词（短语去掉空格与连字符后为拼写目标）
 *   zh    中文意思（终考的唯一提示）
 *   emo   emoji 图形表征
 *   syl   音节拆分（提示 2 用）
 *   tip   记忆钩子（中文谐音/词根/语境，提示 3 用）
 * ============================================================ */

const BOOKS = [
  {
    id: 'pep4a',
    name: '四年级上册',
    units: [
      {
        id: 'a1', name: 'Unit 1 我的教室', theme: 'My classroom', emo: '🏫',
        words: [
          { w: 'classroom', zh: '教室', emo: '🏫', syl: ['class', 'room'], tip: 'class（班级）+ room（房间）= 上课的房间' },
          { w: 'window', zh: '窗户', emo: '🪟', syl: ['win', 'dow'], tip: 'win + dow，风吹进来的“风口”' },
          { w: 'blackboard', zh: '黑板', emo: '🧑‍🏫', syl: ['black', 'board'], tip: 'black（黑色）+ board（板子）' },
          { w: 'light', zh: '电灯', emo: '💡', syl: ['light'], tip: '和 right（正确）同音' },
          { w: 'picture', zh: '图画；照片', emo: '🖼️', syl: ['pic', 'ture'], tip: 'pic 短音 + ture /tʃə/' },
          { w: 'door', zh: '门', emo: '🚪', syl: ['door'], tip: 'oo 发长音 /ɔː/' },
          { w: 'computer', zh: '计算机；电脑', emo: '💻', syl: ['com', 'pu', 'ter'], tip: 'com（共同）+ put（放）+ er' },
          { w: 'fan', zh: '风扇', emo: '🌀', syl: ['fan'], tip: '也是“粉丝”，都为“追风的人”' },
          { w: 'wall', zh: '墙', emo: '🧱', syl: ['wall'], tip: 'wall 里有 all' },
          { w: 'floor', zh: '地板', emo: '🟫', syl: ['floor'], tip: 'oo 发 /ɔː/' },
          { w: 'clean', zh: '打扫；清洁的', emo: '🧽', syl: ['clean'], tip: 'cl- 开头，读 /kliːn/' },
          { w: 'help', zh: '帮助', emo: '🙋', syl: ['help'], tip: 'h + elp' },
        ],
      },
      {
        id: 'a2', name: 'Unit 2 我的书包', theme: 'My schoolbag', emo: '🎒',
        words: [
          { w: 'schoolbag', zh: '书包', emo: '🎒', syl: ['school', 'bag'], tip: 'school + bag，装学校的袋子' },
          { w: 'notebook', zh: '笔记本', emo: '📓', syl: ['note', 'book'], tip: 'note（笔记）+ book' },
          { w: 'storybook', zh: '故事书', emo: '📕', syl: ['sto', 'ry', 'book'], tip: 'story + book' },
          { w: 'candy', zh: '糖果', emo: '🍬', syl: ['can', 'dy'], tip: 'c + andy' },
          { w: 'toy', zh: '玩具', emo: '🧸', syl: ['toy'], tip: 'oy 发 /ɔɪ/' },
          { w: 'key', zh: '钥匙', emo: '🔑', syl: ['key'], tip: '和 quay 同音 /kiː/' },
          { w: 'lost', zh: '丢失', emo: '❓', syl: ['lost'], tip: 'lose 的过去式' },
          { w: 'cute', zh: '可爱的', emo: '🥰', syl: ['cute'], tip: 'u_e 结构，u 读 /juː/' },
        ],
      },
      {
        id: 'a3', name: 'Unit 3 我的朋友', theme: 'My friends', emo: '🧒',
        words: [
          { w: 'strong', zh: '强壮的', emo: '💪', syl: ['strong'], tip: 'str- 三连辅音' },
          { w: 'friendly', zh: '友好的', emo: '🤝', syl: ['friend', 'ly'], tip: 'friend + ly（形容词尾巴）' },
          { w: 'quiet', zh: '安静的', emo: '🤫', syl: ['qui', 'et'], tip: 'quie 读 /kwaɪ/' },
          { w: 'hair', zh: '头发', emo: '💇', syl: ['hair'], tip: 'air 组合' },
          { w: 'shoe', zh: '鞋', emo: '👟', syl: ['shoe'], tip: 'oe 发 /uː/' },
          { w: 'glasses', zh: '眼镜', emo: '👓', syl: ['glas', 'ses'], tip: 'glass + es' },
          { w: 'hat', zh: '帽子', emo: '🎩', syl: ['hat'], tip: 'h + at' },
          { w: 'right', zh: '正确的；右边', emo: '✅', syl: ['right'], tip: '和 light 同音' },
        ],
      },
      {
        id: 'a4', name: 'Unit 4 我的家', theme: 'My home', emo: '🏠',
        words: [
          { w: 'bedroom', zh: '卧室', emo: '🛏️', syl: ['bed', 'room'], tip: 'bed + room' },
          { w: 'kitchen', zh: '厨房', emo: '🍳', syl: ['kitch', 'en'], tip: 'kitch + en' },
          { w: 'bathroom', zh: '浴室；洗手间', emo: '🛁', syl: ['bath', 'room'], tip: 'bath（洗澡）+ room' },
          { w: 'study', zh: '书房', emo: '📚', syl: ['stu', 'dy'], tip: '也是“学习”' },
          { w: 'fridge', zh: '冰箱', emo: '🧊', syl: ['fridge'], tip: 'refrigerator 的简称' },
          { w: 'sofa', zh: '沙发', emo: '🛋️', syl: ['so', 'fa'], tip: '音译词' },
          { w: 'table', zh: '桌子', emo: '🪑', syl: ['ta', 'ble'], tip: '-ble 发 /bl/' },
          { w: 'phone', zh: '电话', emo: '📞', syl: ['phone'], tip: 'ph 发 /f/' },
        ],
      },
      {
        id: 'a5', name: "Unit 5 晚餐准备好了", theme: "Dinner's ready", emo: '🍽️',
        words: [
          { w: 'beef', zh: '牛肉', emo: '🥩', syl: ['beef'], tip: 'ee 发 /iː/' },
          { w: 'chicken', zh: '鸡肉', emo: '🍗', syl: ['chick', 'en'], tip: 'chick（小鸡）+ en' },
          { w: 'noodles', zh: '面条', emo: '🍜', syl: ['noo', 'dles'], tip: 'noodle + s' },
          { w: 'soup', zh: '汤', emo: '🥣', syl: ['soup'], tip: 'ou 发 /uː/' },
          { w: 'vegetable', zh: '蔬菜', emo: '🥬', syl: ['veg', 'eta', 'ble'], tip: 'vege + table' },
          { w: 'chopsticks', zh: '筷子', emo: '🥢', syl: ['chop', 'sticks'], tip: 'chop（砍）+ sticks（棍）' },
          { w: 'bowl', zh: '碗', emo: '🥣', syl: ['bowl'], tip: 'ow 发 /əʊ/' },
          { w: 'knife', zh: '刀', emo: '🔪', syl: ['knife'], tip: 'k 不发音' },
          { w: 'spoon', zh: '勺', emo: '🥄', syl: ['spoon'], tip: 'oo 发 /uː/' },
          { w: 'dinner', zh: '正餐', emo: '🍲', syl: ['din', 'ner'], tip: 'din + ner' },
        ],
      },
      {
        id: 'a6', name: 'Unit 6 见见我的家人', theme: 'Meet my family', emo: '👨‍👩‍👧',
        words: [
          { w: 'parents', zh: '父母', emo: '👨‍👩‍👧', syl: ['par', 'ents'], tip: 'parent + s' },
          { w: 'cousin', zh: '表兄妹；堂兄妹', emo: '🧑‍🤝‍🧑', syl: ['cou', 'sin'], tip: 'cou + sin' },
          { w: 'uncle', zh: '叔叔；舅舅', emo: '🧔', syl: ['un', 'cle'], tip: 'un + cle /kl/' },
          { w: 'aunt', zh: '阿姨；姑姑', emo: '👩', syl: ['aunt'], tip: 'au 发 /ɑː/' },
          { w: 'doctor', zh: '医生', emo: '👨‍⚕️', syl: ['doc', 'tor'], tip: 'doct + or' },
          { w: 'driver', zh: '司机', emo: '🚕', syl: ['dri', 'ver'], tip: 'drive + r' },
          { w: 'farmer', zh: '农民', emo: '👩‍🌾', syl: ['far', 'mer'], tip: 'farm + er' },
          { w: 'nurse', zh: '护士', emo: '👩‍⚕️', syl: ['nurse'], tip: 'nur + se' },
          { w: 'puppy', zh: '小狗', emo: '🐶', syl: ['pup', 'py'], tip: 'pup（幼崽）+ py' },
          { w: 'job', zh: '工作', emo: '💼', syl: ['job'], tip: 'j + ob' },
        ],
      },
    ],
  },
  {
    id: 'pep4b',
    name: '四年级下册',
    units: [
      {
        id: 'b1', name: 'Unit 1 我的学校', theme: 'My school', emo: '🏫',
        words: [
          { w: 'library', zh: '图书馆', emo: '📚', syl: ['li', 'bra', 'ry'], tip: 'librar + y' },
          { w: 'playground', zh: '操场', emo: '🏃', syl: ['play', 'ground'], tip: 'play + ground' },
          { w: 'garden', zh: '花园；菜园', emo: '🌷', syl: ['gar', 'den'], tip: 'gard + en' },
          { w: 'homework', zh: '作业', emo: '📝', syl: ['home', 'work'], tip: 'home + work' },
          { w: 'art', zh: '美术', emo: '🎨', syl: ['art'], tip: 'ar 发 /ɑː/' },
          { w: 'music', zh: '音乐', emo: '🎵', syl: ['mu', 'sic'], tip: 'mu + sic' },
          { w: 'bedroom', zh: '卧室', emo: '🛏️', syl: ['bed', 'room'], tip: 'bed + room' },
        ],
      },
      {
        id: 'b2', name: 'Unit 2 几点了', theme: 'What time is it?', emo: '⏰',
        words: [
          { w: 'breakfast', zh: '早餐', emo: '🥞', syl: ['break', 'fast'], tip: 'break（打破）+ fast（禁食）= 开斋' },
          { w: 'lunch', zh: '午餐', emo: '🍱', syl: ['lunch'], tip: 'l + unch' },
          { w: 'dinner', zh: '正餐', emo: '🍲', syl: ['din', 'ner'], tip: 'din + ner' },
          { w: 'o\'clock', zh: '……点钟', emo: '🕐', syl: ['o', 'clock'], tip: 'of the clock 的缩略' },
          { w: 'school', zh: '学校', emo: '🏫', syl: ['school'], tip: 'ch 发 /k/' },
          { w: 'home', zh: '家', emo: '🏡', syl: ['home'], tip: 'h + ome' },
          { w: 'now', zh: '现在', emo: '⏱️', syl: ['now'], tip: 'ow 发 /aʊ/' },
          { w: 'thirty', zh: '三十', emo: '3️⃣0️⃣', syl: ['thir', 'ty'], tip: 'thir + ty' },
        ],
      },
      {
        id: 'b3', name: 'Unit 3 天气', theme: 'Weather', emo: '🌤️',
        words: [
          { w: 'weather', zh: '天气', emo: '🌤️', syl: ['wea', 'ther'], tip: 'whea + ther' },
          { w: 'sunny', zh: '晴朗的', emo: '☀️', syl: ['sun', 'ny'], tip: 'sun + ny' },
          { w: 'windy', zh: '多风的', emo: '💨', syl: ['win', 'dy'], tip: 'wind + y' },
          { w: 'cloudy', zh: '多云的', emo: '☁️', syl: ['clou', 'dy'], tip: 'cloud + y' },
          { w: 'snowy', zh: '下雪的', emo: '❄️', syl: ['snow', 'y'], tip: 'snow + y' },
          { w: 'rainy', zh: '下雨的；多雨的', emo: '🌧️', syl: ['rai', 'ny'], tip: 'rain + y' },
          { w: 'warm', zh: '温暖的', emo: '🌡️', syl: ['warm'], tip: 'ar 发 /ɔː/' },
          { w: 'cold', zh: '寒冷的', emo: '🥶', syl: ['cold'], tip: 'c + old' },
          { w: 'cool', zh: '凉的；凉爽的', emo: '🍃', syl: ['cool'], tip: 'oo 发 /uː/' },
          { w: 'hot', zh: '热的', emo: '🔥', syl: ['hot'], tip: 'h + ot' },
        ],
      },
      {
        id: 'b4', name: 'Unit 4 在农场', theme: 'At the farm', emo: '🚜',
        words: [
          { w: 'tomato', zh: '西红柿', emo: '🍅', syl: ['to', 'ma', 'to'], tip: 'to + ma + to' },
          { w: 'potato', zh: '土豆；马铃薯', emo: '🥔', syl: ['po', 'ta', 'to'], tip: 'po + ta + to' },
          { w: 'carrot', zh: '胡萝卜', emo: '🥕', syl: ['car', 'rot'], tip: 'carr + ot，双写 r' },
          { w: 'horse', zh: '马', emo: '🐴', syl: ['horse'], tip: 'or 发 /ɔː/' },
          { w: 'sheep', zh: '羊；绵羊', emo: '🐑', syl: ['sheep'], tip: 'ee 发 /iː/，单复同形' },
          { w: 'cow', zh: '奶牛', emo: '🐄', syl: ['cow'], tip: 'ow 发 /aʊ/' },
          { w: 'hen', zh: '母鸡', emo: '🐔', syl: ['hen'], tip: 'h + en' },
          { w: 'goat', zh: '山羊', emo: '🐐', syl: ['goat'], tip: 'oa 发 /əʊ/' },
          { w: 'farm', zh: '农场', emo: '🚜', syl: ['farm'], tip: 'f + arm' },
          { w: 'animal', zh: '动物', emo: '🐾', syl: ['a', 'ni', 'mal'], tip: 'ani + mal' },
        ],
      },
      {
        id: 'b5', name: 'Unit 5 我的衣服', theme: 'My clothes', emo: '👕',
        words: [
          { w: 'clothes', zh: '衣服；服装', emo: '👕', syl: ['clo', 'thes'], tip: 'th 发 /ð/' },
          { w: 'pants', zh: '裤子', emo: '👖', syl: ['pants'], tip: '总是复数形式' },
          { w: 'dress', zh: '连衣裙', emo: '👗', syl: ['dress'], tip: 'dr- 开头' },
          { w: 'skirt', zh: '裙子', emo: '🩳', syl: ['skirt'], tip: 'sk + irt' },
          { w: 'coat', zh: '外套；大衣', emo: '🧥', syl: ['coat'], tip: 'oa 发 /əʊ/' },
          { w: 'sweater', zh: '毛衣', emo: '🧶', syl: ['swea', 'ter'], tip: 'sweat（汗）+ er' },
          { w: 'shorts', zh: '短裤', emo: '🩳', syl: ['shorts'], tip: 'short + s' },
          { w: 'shirt', zh: '衬衫', emo: '👔', syl: ['shirt'], tip: 'skirt 去掉 k' },
        ],
      },
      {
        id: 'b6', name: 'Unit 6 购物', theme: 'Shopping', emo: '🛒',
        words: [
          { w: 'glove', zh: '手套', emo: '🧤', syl: ['glove'], tip: 'g + love' },
          { w: 'scarf', zh: '围巾', emo: '🧣', syl: ['scarf'], tip: 'sc + arf，复数是 scarves' },
          { w: 'umbrella', zh: '雨伞', emo: '☂️', syl: ['um', 'brel', 'la'], tip: 'um + brel + la' },
          { w: 'sunglasses', zh: '太阳镜', emo: '🕶️', syl: ['sun', 'glas', 'ses'], tip: 'sun + glasses' },
          { w: 'pretty', zh: '漂亮的', emo: '✨', syl: ['pret', 'ty'], tip: 'prett + y，双写 t' },
          { w: 'cheap', zh: '便宜的', emo: '💸', syl: ['cheap'], tip: 'ea 发 /iː/' },
          { w: 'expensive', zh: '昂贵的', emo: '💎', syl: ['ex', 'pen', 'sive'], tip: 'ex（出）+ pensive（花）' },
          { w: 'nice', zh: '好的；令人愉快的', emo: '👍', syl: ['nice'], tip: 'c 发 /s/' },
        ],
      },
    ],
  },
];

/* 扁平化全部词条，附带归属单元 */
function buildWordIndex() {
  const all = [];
  BOOKS.forEach((book) => {
    book.units.forEach((unit) => {
      unit.words.forEach((item) => {
        item.id = unit.id + ':' + item.w;
        item.unitId = unit.id;
        item.unitName = unit.name;
        item.unitEmo = unit.emo;
        item.bookId = book.id;
        item.bookName = book.name;
        all.push(item);
      });
    });
  });
  return all;
}

const ALL_WORDS = buildWordIndex();

/* 拼写目标：去掉空格、连字符、撇号 */
function spellingTarget(word) {
  return word.replace(/[\s\-']/g, '');
}

/* 按单元取词（id 已就地写到 BOOKS 上） */
function wordsOfUnit(unitId) {
  for (const book of BOOKS) {
    for (const u of book.units) if (u.id === unitId) return u.words;
  }
  return [];
}
