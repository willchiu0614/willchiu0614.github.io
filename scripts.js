// scripts.js

const selectedMap = new Map();  // 用 Map 取代陣列提升效能

function playSound(elem) {
  const sound = elem.dataset.sound;
  const group = elem.dataset.group;

  if (elem.classList.toggle('selected')) {
    selectedMap.set(sound, { sound, group });
  } else {
    selectedMap.delete(sound);
  }

  try {
    new Audio(sound).play();
  } catch (e) {
    console.warn("音訊播放失敗：", sound, e);
  }
}

function playSelectedSounds() {
  if (selectedMap.size === 0) {
    alert("請先選擇要播放的按鈕！");
    return;
  }

  const values = Array.from(selectedMap.values());
  const side = values.find(i => i.group === "side");
  const body = values.filter(i => i.group === "body");
  const symptom = values.find(i => i.group === "symptom");
  const need = values.filter(i => i.group === "need");

  const sequence = ["audio/my.wav"];
  const textParts = [];

  if (side) {
    sequence.push(side.sound);
    textParts.push(getLabelBySound(side.sound) + "的");
  }

  body.forEach((item, idx) => {
    sequence.push(item.sound);
    if (idx < body.length - 1) {
      sequence.push("audio/and.wav");
    }
  });

  if (body.length > 0) {
    const coloredBody = body.map(item =>
      `<span style="color:red">${getLabelBySound(item.sound)}</span>`
    ).join("、");
    textParts.push(coloredBody);
  }

  if (symptom) {
    sequence.push(symptom.sound);
    textParts.push("感覺" + getLabelBySound(symptom.sound));
  }

  need.forEach((item, idx) => {
    sequence.push(item.sound);
    if (idx < need.length - 1) {
      sequence.push("audio/and.wav");
    }
  });

  if (need.length > 0) {
    const coloredBody = need.map(item =>
      `<span style="color:red">${getLabelBySound(item.sound)}</span>`
    ).join("、");
    textParts.push(coloredBody);
  }

  document.getElementById("result").innerHTML = "你選擇的是：" + textParts.join(" ");

  playAudioSequence(sequence);
}

function playAudioSequence(sequence) {
  let index = 0;

  function playNext() {
    if (index >= sequence.length) return;

    const audio = new Audio(sequence[index++]);
    audio.onended = playNext;

    try {
      audio.play();
    } catch (e) {
      console.warn("音訊播放失敗：", sequence[index - 1], e);
      playNext();  // 繼續播放下一個
    }
  }

  playNext();
}

function getLabelBySound(soundPath) {
  const btn = document.querySelector(`.img-btn[data-sound="${soundPath}"]`);
  if (!btn) {
    console.warn("找不到對應的 button 元素：", soundPath);
    return "";
  }
  return btn.dataset.label;
}

function clearSelections() {
  document.querySelectorAll('.img-btn').forEach(btn => btn.classList.remove('selected'));
  selectedMap.clear();
}

function showTab(index) {
  const tabs = document.querySelectorAll(".tab-content");
  const buttons = document.querySelectorAll(".tab-btn");

  tabs.forEach((tab, i) => {
    tab.style.display = (i === index) ? "block" : "none";
  });

  buttons.forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });
}
