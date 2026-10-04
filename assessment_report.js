/* Offline, teacher-readable PDF summary of the twelve activities on a learning day. */
(function(root){
  function plain(value){
    return String(value??'').replace(/[’‘]/g,"'").replace(/[–—→]/g,'-')
      .normalize('NFKD').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
  }
  function lines(text,font,size,width){
    const words=plain(text).split(' '),out=[];
    let line='';
    for(const word of words){
      const next=line?line+' '+word:word;
      if(line&&font.widthOfTextAtSize(next,size)>width){out.push(line);line=word}
      else line=next;
    }
    if(line)out.push(line);
    return out;
  }
  function curriculumNote(level,index){
    const early=level==='Entry Way';
    switch(index){
      case 0:return level==='Explorer'?'Use meaningful word parts to work out how words are formed.':
        early?'Connect a spoken sound with the letter that represents it.':'Apply phonics patterns to identify sounds in words.';
      case 1:return level==='Explorer'?'Use meaningful word parts and patterns to build a word.':
        early?'Blend and segment sounds to read and spell a word.':'Use phonics knowledge to blend the parts of a word.';
      case 2:return early?'Use letter-sound knowledge to read a word.':'Understand a word and connect it to its meaning or context.';
      case 3:return level==='Explorer'?'Use word parts and patterns when constructing a spelling.':
        early?'Segment sounds and spell the word with letter patterns.':'Make a spelling choice using letter patterns in a word.';
      case 4:return early?'Construct a clear simple sentence.':'Construct a sentence with an appropriate form and structure.';
      case 5:return 'Use capitals, punctuation, and sentence conventions to make meaning clear.';
      case 6:return early||level==='Excite'?'Use picture details to connect images and sentences.':
        'Draft connected sentences that develop an idea from a visual prompt.';
      case 7:return early||level==='Excite'?'Connect information in a short text with a matching image.':
        'Identify important details in a paragraph to understand its scene.';
      case 8:return 'Identify the main idea and important details in a text.';
      case 9:return 'Use stated and implied clues as evidence for an inference.';
      case 10:return 'Use the meaning and context of a taught word to complete a sentence.';
      case 11:return 'Match taught theme words to their meanings.';
      default:return '';
    }
  }
  async function createPdf(pdfLib,record){
    if(!pdfLib||!record||!Array.isArray(record.items)||record.items.length!==12)
      throw Error('The assessment needs all twelve activities.');
    const {PDFDocument,StandardFonts,rgb}=pdfLib;
    const pdf=await PDFDocument.create();
    pdf.setTitle(`Fall Language Path 1 - ${record.level} ${record.day} assessment`);
    pdf.setAuthor('Fall Language Path 1');
    pdf.setSubject('Per-question attempt counts and completion');
    const regular=await pdf.embedFont(StandardFonts.Helvetica);
    const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink=rgb(.09,.23,.20),green=rgb(.10,.39,.32),pale=rgb(.93,.97,.94),gold=rgb(.99,.96,.87);
    const total=record.attempts.reduce((sum,n)=>sum+(Number(n)||0),0);
    const done=record.completed.filter(Boolean).length;
    const question=(index)=>{
      const entry=record.items[index],item=entry.item;
      const attempt=Number(record.attempts[index])||0;
      const status=record.completed[index]?(attempt?'Completed':'Completed earlier; count unavailable'):
        attempt?'Still practising':'Not attempted';
      const prompt=item.kind==='cloze'?item.sentence:item.audioPrompt||item.prompt;
      return {name:entry.name,number:item.number,expectation:item.expectation,attempt,
        status:index===4?status+`; moves: ${Number(record.sentenceMoves)||0}`+(record.answerViewed?'; answer viewed':''):status,
        prompt,note:item.curriculumExplanation||curriculumNote(record.level,index)};
    };
    const ranges=[[0,4],[4,8],[8,11],[11,12]];
    for(let pageIndex=0;pageIndex<ranges.length;pageIndex++){
      const page=pdf.addPage([612,792]);
      page.drawRectangle({x:0,y:698,width:612,height:94,color:green});
      page.drawText('Fall Language Path 1',{x:38,y:750,size:20,font:bold,color:rgb(1,1,1)});
      page.drawText('Assessment: attempts by question',{x:38,y:724,size:12,font:regular,color:rgb(1,1,1)});
      page.drawText(`${plain(record.level)}  |  ${plain(record.day)} ${plain(record.theme)}`,
        {x:38,y:668,size:13,font:bold,color:ink});
      if(pageIndex===0){
        page.drawText(`Activities completed: ${done} of 12     Total attempts: ${total}`,
          {x:38,y:643,size:10,font:regular,color:ink});
        page.drawText(`Report date: ${plain(record.date)}     Learner: __________________________`,
          {x:38,y:625,size:10,font:regular,color:ink});
      }else{
        page.drawText('Attempts increase when an answer is chosen or Check is pressed.',
          {x:38,y:643,size:10,font:regular,color:ink});
        page.drawText(pageIndex===3?'The ten matching pads each have their own attempt count.':
          'A completed writing response met the on-page format checks; review its meaning separately.',
          {x:38,y:625,size:9,font:regular,color:ink});
      }
      const [start,end]=ranges[pageIndex];
      let y=601;
      if(pageIndex===3){
        const item=record.items[11].item;
        page.drawText('Q12. Vocabulary Landing Pads',{x:40,y:599,size:13,font:bold,color:ink});
        page.drawText(`Ontario ${plain(item.expectation)}  |  ${plain(item.curriculumExplanation)}`,
          {x:40,y:579,size:9,font:regular,color:green});
        page.drawText('Each definition was checked separately. Words can be moved and checked again.',
          {x:40,y:562,size:9,font:regular,color:ink});
        item.pads.forEach((pad,padIndex)=>{
          const rowY=544-padIndex*46;
          const chosen=record.matchPlaced?.[padIndex];
          const chosenWord=Number.isInteger(chosen)?item.words[chosen]?.text:'none';
          const attempts=Number(record.matchPadAttempts?.[padIndex])||0;
          const correct=!!record.matchCorrect?.[padIndex];
          page.drawRectangle({x:38,y:rowY-37,width:536,height:43,
            color:padIndex%2?pale:gold,borderColor:rgb(.73,.83,.75),borderWidth:.5});
          page.drawText(`Pad ${padIndex+1}  |  Placed: ${plain(chosenWord)}  |  Attempts: ${attempts}  |  ${correct?'Correct':'Practising'}`,
            {x:46,y:rowY-7,size:8.5,font:bold,color:ink});
          lines(pad.definition,regular,7.5,510).slice(0,2).forEach((part,lineIndex)=>
            page.drawText(part,{x:46,y:rowY-20-lineIndex*10,size:7.5,font:regular,color:ink}));
        });
      }
      for(let index=start;index<end&&pageIndex!==3;index++){
        const q=question(index);
        const promptLines=lines(q.prompt,regular,9,513).slice(0,2);
        const noteLines=lines('Curriculum focus: '+q.note,regular,8.6,510).slice(0,2);
        const height=101;
        page.drawRectangle({x:36,y:y-height+3,width:540,height:height-5,
          color:index%2?pale:gold,borderColor:rgb(.73,.83,.75),borderWidth:.5});
        page.drawText(`Q${q.number}. ${plain(q.name)}`,
          {x:48,y:y-17,size:11,font:bold,color:ink});
        page.drawText(`Ontario ${plain(q.expectation)}`,
          {x:465,y:y-17,size:9,font:regular,color:green});
        promptLines.forEach((part,j)=>page.drawText(part,{x:48,y:y-35-j*12,size:9,font:regular,color:ink}));
        noteLines.forEach((part,j)=>page.drawText(part,{x:48,y:y-65-j*11,size:8.6,font:regular,color:ink}));
        page.drawText(`Attempts: ${q.attempt}     ${q.status}`,
          {x:48,y:y-91,size:9,font:bold,color:green});
        y-=height;
      }
      if(pageIndex===2){
        page.drawText('Teacher notes / next step:',{x:40,y:240,size:10,font:bold,color:ink});
        for(const lineY of [218,185,152,119])page.drawLine({start:{x:40,y:lineY},end:{x:570,y:lineY},thickness:.7,color:rgb(.55,.69,.60)});
      }
      page.drawLine({start:{x:38,y:48},end:{x:574,y:48},thickness:1,color:green});
      page.drawText(`Page ${pageIndex+1} of 4  |  Ontario Language  |  Counts are saved in this browser.`,
        {x:38,y:32,size:8,font:regular,color:ink});
    }
    return pdf.save();
  }
  const api={createPdf};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ForestAssessment=api;
})(typeof window!=='undefined'?window:globalThis);
