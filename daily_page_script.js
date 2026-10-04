(()=>{
  const DATA=window.DAY_DATA;
  const STORAGE=window.DAY_STORAGE;
  const ATTEMPT_STORAGE=STORAGE+'-attempts-v1';
  const HELP_STORAGE=STORAGE+'-sentence-help-v1';
  const MATCH_INDEX=DATA.findIndex(activity=>activity.item.kind==='match');
  const MATCH_STORAGE=STORAGE+'-matching-v1';
  const cards=[...document.querySelectorAll('.activity')];
  const placed=DATA.map(()=>[]);
  const selectedCloze=DATA.map(()=>null);
  let completed=DATA.map(()=>false);
  let attempts=DATA.map(()=>0);
  let sentenceMoves=0,answerViewed=false;
  let matchPlaced=Array(10).fill(null),matchCorrect=Array(10).fill(false),matchPadAttempts=Array(10).fill(0),matchSelected=null;
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE)||'[]');
    if(Array.isArray(saved))completed=completed.map((_,i)=>!!saved[i]);
  }catch{}
  try{
    const saved=JSON.parse(localStorage.getItem(HELP_STORAGE)||'{}');
    if(Number.isSafeInteger(saved.moves)&&saved.moves>=0)sentenceMoves=saved.moves;
    answerViewed=!!saved.viewed;
  }catch{}
  try{
    const saved=JSON.parse(localStorage.getItem(ATTEMPT_STORAGE)||'[]');
    if(Array.isArray(saved))attempts=attempts.map((_,i)=>Number.isSafeInteger(saved[i])&&saved[i]>=0?saved[i]:0);
  }catch{}
  if(MATCH_INDEX>=0){
    try{
      const saved=JSON.parse(localStorage.getItem(MATCH_STORAGE)||'{}');
      if(Array.isArray(saved.placed)&&saved.placed.length===10&&
          saved.placed.every(value=>value===null||Number.isInteger(value)&&value>=0&&value<10)&&
          new Set(saved.placed.filter(value=>value!==null)).size===saved.placed.filter(value=>value!==null).length){
        matchPlaced=saved.placed;
        if(Array.isArray(saved.correct)&&saved.correct.length===10)
          matchCorrect=saved.correct.map((value,pad)=>!!value&&matchPlaced[pad]===DATA[MATCH_INDEX].item.pads[pad].answer);
        if(Array.isArray(saved.attempts)&&saved.attempts.length===10)
          matchPadAttempts=saved.attempts.map(value=>Number.isSafeInteger(value)&&value>=0?value:0);
      }
    }catch{}
  }
  let audio=null,activeButton=null;

  function feedback(index,message,kind){
    const node=cards[index].querySelector('[data-feedback]');
    node.textContent=message;
    node.className='feedback '+kind;
  }
  function updateProgress(){
    const count=completed.filter(Boolean).length;
    document.getElementById('progress-bar').style.width=`${100*count/DATA.length}%`;
    document.getElementById('progress-label').textContent=`${count} of ${DATA.length} activities completed`;
    cards.forEach((card,i)=>card.classList.toggle('completed',completed[i]));
  }
  function markDone(index){
    completed[index]=true;
    try{localStorage.setItem(STORAGE,JSON.stringify(completed))}catch{}
    updateProgress();
  }
  function showAttempts(index){
    const badge=cards[index].querySelector('[data-attempts]');
    if(badge)badge.textContent=`Attempts: ${attempts[index]}`;
  }
  function recordAttempt(index){
    attempts[index]++;
    try{localStorage.setItem(ATTEMPT_STORAGE,JSON.stringify(attempts))}catch{}
    showAttempts(index);
  }
  function showSentenceHelp(){
    const card=cards[4],counter=card?.querySelector('[data-moves]'),button=card?.querySelector('[data-show-answer]');
    if(counter)counter.textContent=`Moves: ${sentenceMoves}. ${sentenceMoves<6?'Make six moves to unlock help.':'Answer help is available.'}`;
    if(button)button.hidden=sentenceMoves<6;
    const reveal=card?.querySelector('[data-answer-reveal]');
    if(reveal&&answerViewed){reveal.hidden=false;reveal.textContent='Answer: '+DATA[4].item.answerText}
  }
  function recordSentenceMove(index){
    if(index!==4)return;
    sentenceMoves++;
    try{localStorage.setItem(HELP_STORAGE,JSON.stringify({moves:sentenceMoves,viewed:answerViewed}))}catch{}
    showSentenceHelp();
  }
  const reportButton=document.getElementById('download-assessment');
  if(reportButton)reportButton.onclick=async()=>{
    const status=document.getElementById('assessment-status');
    reportButton.disabled=true;
    status.textContent='Preparing your assessment PDF…';
    try{
      const meta=window.DAY_META;
      const record={...meta,date:new Date().toLocaleDateString('en-CA'),items:DATA,attempts:[...attempts],completed:[...completed],sentenceMoves,answerViewed,matchPadAttempts:[...matchPadAttempts],matchCorrect:[...matchCorrect],matchPlaced:[...matchPlaced]};
      const bytes=await window.ForestAssessment.createPdf(window.PDFLib,record);
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      const link=document.createElement('a');
      link.href=url;
      link.download=`Fall-Language-Path-1-${STORAGE.replace('white-forest-daily-','')}-assessment.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent='Assessment PDF downloaded. 📄';
    }catch{
      status.textContent='The PDF could not be prepared. Please try again.';
    }finally{reportButton.disabled=false}
  };
  function stopAudio(){
    if(audio){audio.pause();audio.currentTime=0;audio=null}
    if(activeButton){
      activeButton.textContent=activeButton.dataset.defaultLabel;
      activeButton.setAttribute('aria-pressed','false');
      activeButton=null;
    }
  }
  function playAudio(source,button,index){
    if(activeButton===button){stopAudio();return}
    stopAudio();
    const clip=new Audio(source);
    clip.playbackRate=.85;
    audio=clip;
    activeButton=button;
    button.dataset.defaultLabel=button.textContent;
    button.textContent='⏹️ Stop reading';
    button.setAttribute('aria-pressed','true');
    clip.onended=stopAudio;
    clip.onerror=()=>{
      stopAudio();
      if(index!==null)feedback(index,'The recording is unavailable. The same text is on this card.','try');
    };
    clip.play().catch(()=>{
      stopAudio();
      if(index!==null)feedback(index,'Tap Hear again to play the recording.','try');
    });
  }
  const intro=document.getElementById('hear-intro');
  intro.onclick=()=>playAudio(intro.dataset.audio,intro,null);
  const glossaryButton=document.getElementById('hear-glossary');
  if(glossaryButton)glossaryButton.onclick=()=>playAudio(glossaryButton.dataset.audio,glossaryButton,null);

  function saveMatching(){
    try{localStorage.setItem(MATCH_STORAGE,JSON.stringify({placed:matchPlaced,correct:matchCorrect,attempts:matchPadAttempts}))}catch{}
  }
  function drawMatching(){
    if(MATCH_INDEX<0)return;
    const card=cards[MATCH_INDEX],item=DATA[MATCH_INDEX].item,bank=card.querySelector('[data-word-bank]');
    bank.replaceChildren();
    item.bankOrder.forEach(wordIndex=>{
      if(matchPlaced.includes(wordIndex))return;
      const word=item.words[wordIndex],button=document.createElement('button');
      button.type='button';button.className='match-word';button.draggable=true;
      button.dataset.matchWord=String(wordIndex);
      button.innerHTML=`<span aria-hidden="true">${word.icon}</span> ${word.text}`;
      button.setAttribute('aria-label','Select '+word.text+' for a definition landing pad');
      button.setAttribute('aria-pressed',String(matchSelected===wordIndex));
      button.onclick=()=>{stopAudio();matchSelected=wordIndex;drawMatching()};
      button.ondragstart=event=>event.dataTransfer.setData('text/plain',`match:${MATCH_INDEX}:${wordIndex}`);
      bank.append(button);
    });
    if(!bank.children.length){const note=document.createElement('p');note.textContent='All words are on landing pads. Move any word to change it.';bank.append(note)}
    item.pads.forEach((pad,padIndex)=>{
      const slot=card.querySelector(`[data-match-slot="${padIndex}"]`),wordIndex=matchPlaced[padIndex];
      const word=wordIndex===null?null:item.words[wordIndex];
      slot.textContent=word?`${word.icon} ${word.text}`:'👇 Drop or select a word';
      slot.classList.toggle('filled',!!word);
      slot.draggable=!!word;
      slot.setAttribute('aria-label',`Landing pad ${padIndex+1}. ${pad.definition} ${word?'Placed: '+word.text+'. Select to move it.':'Empty. Select a word and press this pad.'}`);
      slot.setAttribute('aria-pressed',String(wordIndex!==null&&matchSelected===wordIndex));
      const status=card.querySelector(`[data-match-feedback="${padIndex}"]`);
      status.textContent=matchCorrect[padIndex]?'Correct match! 🌟':wordIndex===null?'Not checked yet.':'Place or check this word.';
      status.className='match-feedback'+(matchCorrect[padIndex]?' good':'');
      card.querySelector(`[data-match-attempts="${padIndex}"]`).textContent=`Attempts: ${matchPadAttempts[padIndex]}`;
    });
  }
  function matchingChanged(){
    if(completed[MATCH_INDEX]){
      completed[MATCH_INDEX]=false;
      try{localStorage.setItem(STORAGE,JSON.stringify(completed))}catch{}
      updateProgress();
    }
    saveMatching();drawMatching();
    const matched=matchCorrect.filter(Boolean).length;
    feedback(MATCH_INDEX,`${matched} of 10 landing pads checked correctly.`,'try');
  }
  function placeMatch(wordIndex,padIndex){
    if(MATCH_INDEX<0||!Number.isInteger(wordIndex)||wordIndex<0||wordIndex>=10||!Number.isInteger(padIndex)||padIndex<0||padIndex>=10)return;
    stopAudio();
    const previous=matchPlaced.indexOf(wordIndex);
    if(previous===padIndex)return;
    if(previous>=0){matchPlaced[previous]=null;matchCorrect[previous]=false}
    matchPlaced[padIndex]=wordIndex;matchCorrect[padIndex]=false;
    matchSelected=null;matchingChanged();
  }
  function clearMatch(padIndex){
    stopAudio();
    if(matchPlaced[padIndex]===null)return;
    matchPlaced[padIndex]=null;matchCorrect[padIndex]=false;matchSelected=null;matchingChanged();
  }
  function checkMatch(padIndex){
    stopAudio();
    const card=cards[MATCH_INDEX],status=card.querySelector(`[data-match-feedback="${padIndex}"]`);
    if(matchPlaced[padIndex]===null){status.textContent='Choose a word for this pad first. 🌱';status.className='match-feedback try';return}
    if(matchCorrect[padIndex]){status.textContent='Correct match! 🌟';return}
    recordAttempt(MATCH_INDEX);matchPadAttempts[padIndex]++;
    matchCorrect[padIndex]=matchPlaced[padIndex]===DATA[MATCH_INDEX].item.pads[padIndex].answer;
    saveMatching();drawMatching();
    status.textContent=matchCorrect[padIndex]?'Yes, that word fits this definition. 🌟':'Try a different word on this pad. 🌱';
    status.className='match-feedback '+(matchCorrect[padIndex]?'good':'try');
    const matched=matchCorrect.filter(Boolean).length;
    feedback(MATCH_INDEX,`${matched} of 10 landing pads checked correctly.${matched===10?' You matched every word! 🌟':''}`,matched===10?'good':'try');
    if(matched===10)markDone(MATCH_INDEX);
  }

  function choose(index,choice){
    stopAudio();
    recordAttempt(index);
    const item=DATA[index].item;
    const buttons=[...cards[index].querySelectorAll('[data-choice]')];
    if(choice===item.answer){
      buttons[choice].classList.add('correct');
      feedback(index,'Yes! That choice fits. 🌟','good');
      markDone(index);
    }else{
      buttons[choice].classList.add('incorrect');
      feedback(index,'Try another choice. Look or listen for a clue. 🌱','try');
      setTimeout(()=>buttons[choice].classList.remove('incorrect'),900);
    }
  }
  function drawTiles(index){
    const card=cards[index],item=DATA[index].item;
    const answer=card.querySelector('[data-answer]');
    const tiles=card.querySelectorAll('[data-tile]');
    answer.replaceChildren();
    if(!placed[index].length){
      const hint=document.createElement('span');
      hint.className='placeholder';
      hint.textContent='👆 Tap or drag the tiles here.';
      answer.append(hint);
    }
    placed[index].forEach((tileIndex,position)=>{
      const button=document.createElement('button');
      button.type='button';button.className='tile';button.draggable=true;
      button.dataset.position=String(position);
      button.textContent=item.tiles[tileIndex];
      button.setAttribute('aria-label','Move or remove '+item.tiles[tileIndex]+'. Use left or right arrow keys to change its place.');
      button.onclick=()=>{stopAudio();placed[index].splice(position,1);recordSentenceMove(index);drawTiles(index)};
      button.onkeydown=event=>{
        if(event.key==='ArrowLeft'&&position>0){event.preventDefault();moveTile(index,position,position-1)}
        if(event.key==='ArrowRight'&&position<placed[index].length-1){event.preventDefault();moveTile(index,position,position+2)}
      };
      button.ondragstart=event=>event.dataTransfer.setData('text/plain',`placed:${index}:${position}`);
      button.ondragover=event=>{
        event.preventDefault();
        const box=button.getBoundingClientRect();
        const before=event.clientX<box.left+box.width/2;
        button.classList.toggle('drop-before',before);
        button.classList.toggle('drop-after',!before);
      };
      button.ondragleave=()=>{button.classList.remove('drop-before','drop-after')};
      button.ondrop=event=>{
        event.preventDefault();event.stopPropagation();
        button.classList.remove('drop-before','drop-after');
        const box=button.getBoundingClientRect();
        dropTile(index,event,event.clientX<box.left+box.width/2?position:position+1);
      };
      answer.append(button);
    });
    tiles.forEach((tile,j)=>tile.disabled=placed[index].includes(j));
  }
  function addTile(index,tile,position=placed[index].length){
    stopAudio();
    if(!Number.isInteger(tile)||tile<0||tile>=DATA[index].item.tiles.length||placed[index].includes(tile))return;
    placed[index].splice(position,0,tile);recordSentenceMove(index);drawTiles(index);
  }
  function moveTile(index,from,position){
    stopAudio();
    if(!Number.isInteger(from)||from<0||from>=placed[index].length)return;
    const destination=from<position?position-1:position;
    if(destination===from)return;
    const [tile]=placed[index].splice(from,1);
    placed[index].splice(destination,0,tile);
    recordSentenceMove(index);drawTiles(index);
  }
  function dropTile(index,event,position){
    const [kind,owner,value]=event.dataTransfer.getData('text/plain').split(':');
    if(Number(owner)!==index)return;
    if(kind==='tile')addTile(index,Number(value),position);
    if(kind==='placed')moveTile(index,Number(value),position);
  }
  function positionAtPoint(answer,event){
    const chips=[...answer.querySelectorAll('.tile')];
    for(let position=0;position<chips.length;position++){
      const box=chips[position].getBoundingClientRect();
      if(event.clientY<box.top||event.clientY<=box.bottom&&event.clientX<box.left+box.width/2)return position;
    }
    return chips.length;
  }
  function selectCloze(index,choice){
    stopAudio();
    const card=cards[index],item=DATA[index].item;
    selectedCloze[index]=choice;
    const blank=card.querySelector('[data-cloze-blank]');
    blank.textContent=item.options[choice];
    blank.classList.add('filled');
    blank.setAttribute('aria-label','Blank filled with '+item.options[choice]+'. Tap to clear.');
    card.querySelectorAll('[data-cloze-option]').forEach((button,j)=>button.setAttribute('aria-pressed',String(j===choice)));
  }
  function clearCloze(index){
    selectedCloze[index]=null;
    const card=cards[index],blank=card.querySelector('[data-cloze-blank]');
    blank.textContent='__________';
    blank.classList.remove('filled');
    blank.setAttribute('aria-label','Blank. Drop a word here.');
    card.querySelectorAll('[data-cloze-option]').forEach(button=>button.setAttribute('aria-pressed','false'));
  }
  function check(index){
    stopAudio();
    recordAttempt(index);
    const item=DATA[index].item,card=cards[index];
    if(item.kind==='cloze'){
      if(selectedCloze[index]===item.answer){
        feedback(index,`Yes! ${item.options[item.answer]} completes the sentence. 🌟`,'good');
        markDone(index);
      }else feedback(index,'Try another word. Read the whole sentence again. 🌱','try');
      return;
    }
    if(item.kind==='build'){
      const result=placed[index].map(j=>item.tiles[j]);
      if(JSON.stringify(result)===JSON.stringify(item.answer)){
        feedback(index,index===4?'Yes! Your sentence is in the right order. 🌟':`Yes! You built ${item.answerText}. 🌟`,'good');
        markDone(index);
      }else feedback(index,'Not quite yet. Tap a tile in your answer to move it back, then try again. 🌱','try');
      return;
    }
    const value=card.querySelector('[data-writing]').value.trim();
    const words=value.match(/[A-Za-z']+/g)||[];
    const sentences=(value.match(/[.!?]/g)||[]).length;
    const missing=item.keywords.filter(k=>!value.toLowerCase().includes(k.toLowerCase()));
    if(words.length<item.minWords||sentences<2||missing.length){
      feedback(index,`Add at least two complete sentences, ${item.minWords} words, and these ideas: ${item.keywords.join(' and ')}. 🌱`,'try');
      return;
    }
    feedback(index,'Your response has the requested length, sentence marks, and picture words. Read it again for sense, then compare with the example. 🌟','good');
    const sample=card.querySelector('[data-sample]');
    sample.hidden=false;
    sample.textContent='One possible response: '+item.sample;
    markDone(index);
  }
  cards.forEach((card,index)=>{
    const item=DATA[index].item;
    card.querySelector('[data-hear]').onclick=event=>playAudio('../'+item.audio,event.currentTarget,index);
    card.querySelectorAll('[data-hear-pad]').forEach(button=>button.onclick=event=>playAudio(button.dataset.audio,event.currentTarget,index));
    card.querySelectorAll('[data-match-slot]').forEach(slot=>{
      const padIndex=Number(slot.dataset.matchSlot);
      slot.onclick=()=>{
        if(matchSelected!==null)placeMatch(matchSelected,padIndex);
        else if(matchPlaced[padIndex]!==null){stopAudio();matchSelected=matchPlaced[padIndex];drawMatching()}
        else{const status=card.querySelector(`[data-match-feedback="${padIndex}"]`);status.textContent='Select a word from the basket first. 🌱';status.className='match-feedback try'}
      };
      slot.ondragstart=event=>{
        if(matchPlaced[padIndex]===null){event.preventDefault();return}
        event.dataTransfer.setData('text/plain',`match:${index}:${matchPlaced[padIndex]}`);
      };
      slot.ondragover=event=>{event.preventDefault();slot.classList.add('drop-target')};
      slot.ondragleave=()=>slot.classList.remove('drop-target');
      slot.ondrop=event=>{
        event.preventDefault();slot.classList.remove('drop-target');
        const [kind,owner,word]=event.dataTransfer.getData('text/plain').split(':');
        if(kind==='match'&&Number(owner)===index)placeMatch(Number(word),padIndex);
      };
    });
    card.querySelectorAll('[data-match-clear]').forEach(button=>button.onclick=()=>clearMatch(Number(button.dataset.matchClear)));
    card.querySelectorAll('[data-match-check]').forEach(button=>button.onclick=()=>checkMatch(Number(button.dataset.matchCheck)));
    card.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>choose(index,Number(button.dataset.choice)));
    card.querySelectorAll('[data-tile]').forEach(button=>{
      button.onclick=()=>addTile(index,Number(button.dataset.tile));
      button.ondragstart=event=>event.dataTransfer.setData('text/plain',`tile:${index}:${button.dataset.tile}`);
    });
    const answer=card.querySelector('[data-answer]');
    if(answer){
      answer.ondragover=event=>event.preventDefault();
      answer.ondrop=event=>{
        event.preventDefault();
        dropTile(index,event,positionAtPoint(answer,event));
      };
      drawTiles(index);
    }
    const clear=card.querySelector('[data-clear]');
    if(clear)clear.onclick=()=>{stopAudio();if(placed[index].length){placed[index]=[];recordSentenceMove(index);drawTiles(index)}};
    const showAnswer=card.querySelector('[data-show-answer]');
    if(showAnswer)showAnswer.onclick=()=>{
      if(sentenceMoves<6)return;
      answerViewed=true;
      try{localStorage.setItem(HELP_STORAGE,JSON.stringify({moves:sentenceMoves,viewed:true}))}catch{}
      showSentenceHelp();
    };
    card.querySelectorAll('[data-cloze-option]').forEach(button=>{
      button.onclick=()=>selectCloze(index,Number(button.dataset.clozeOption));
      button.ondragstart=event=>event.dataTransfer.setData('text/plain',`cloze:${index}:${button.dataset.clozeOption}`);
    });
    const blank=card.querySelector('[data-cloze-blank]');
    if(blank){
      blank.onclick=()=>clearCloze(index);
      blank.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();clearCloze(index)}};
      blank.ondragover=event=>event.preventDefault();
      blank.ondrop=event=>{
        event.preventDefault();
        const [kind,owner,choice]=event.dataTransfer.getData('text/plain').split(':');
        if(kind==='cloze'&&Number(owner)===index)selectCloze(index,Number(choice));
      };
    }
    const checkButton=card.querySelector('[data-check]');
    if(checkButton)checkButton.onclick=()=>check(index);
  });
  drawMatching();
  updateProgress();
  cards.forEach((_,index)=>showAttempts(index));
  cards.forEach((_,index)=>{if(completed[index])feedback(index,'Completed earlier. You can try this activity again. 🌟','good')});
  showSentenceHelp();
})();
