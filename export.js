(function(){
"use strict";
const A=window._tourApp;
const $=A.$,state=A.state;

// ---- Excel Export ----
function exportExcel(){
  if(!state.yearDays.length)return;
  const gs=A.groupSize(),dur=A.duration(),sDur=A.staffMin(),w=A.wage(),sv=A.svFactor(),bf=A.bufFactor();
  const vl=A.vorlauf(),nl=A.nachlauf();
  const rows=state.yearDays.map(d=>{
    const hrs=d.tours*sDur/60;
    return{Datum:A.formatDate(d.date),Tag:A.DOW_SHORT[d.dow],Feiertag:d.ph,Schulferien:d.sh,
      Auslastung:d.level==="none"?"Keine":d.level.toUpperCase(),Führungen:d.tours,
      Gäste:d.tours*gs,"MA-Stunden":Math.round(hrs*100)/100,
      "MA-Kosten":Math.round(hrs*w*100)/100,"MA-Kosten+SV":Math.round(hrs*w*sv*100)/100,
      "MA-Kosten+SV+Puffer":Math.round(hrs*w*sv*bf*100)/100,Notizen:d.notes};
  });
  const ms=A.getMonthlyStats();
  const mRows=ms.map((m,i)=>{
    const hrs=m.mins/60;
    return{Monat:A.MONTH_NAMES[i],Führungen:m.tours,Gäste:m.guests,Tage:m.days,
      "MA-Stunden":Math.round(hrs*100)/100,"MA-Kosten":Math.round(hrs*w*100)/100,
      "MA-Kosten+SV":Math.round(hrs*w*sv*100)/100,"MA-Kosten+SV+Puffer":Math.round(hrs*w*sv*bf*100)/100};
  });
  const wb=XLSX.utils.book_new();
  const ws1=XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws1,"Jahreskalender");
  const ws2=XLSX.utils.json_to_sheet(mRows);
  XLSX.utils.book_append_sheet(wb,ws2,"Monatsübersicht");
  const sRows=[
    {Einstellung:"Jahr",Wert:state.currentYear},
    {Einstellung:"Bundesland",Wert:state.currentState?A.BUNDESLAENDER[state.currentState]:"Bundesweit"},
    {Einstellung:"Gruppengröße",Wert:gs},
    {Einstellung:"Dauer je Führung (Min.)",Wert:dur},
    {Einstellung:"Vorlaufzeit (Min.)",Wert:vl},
    {Einstellung:"Nachlaufzeit (Min.)",Wert:nl},
    {Einstellung:"Arbeitszeit je Führung (Min.)",Wert:sDur},
    {Einstellung:"Stundenlohn (€/h)",Wert:w},
    {Einstellung:"SV-Aufschlag (%)",Wert:Math.round((sv-1)*100*10)/10},
    {Einstellung:"Puffer Krankheit/Urlaub (%)",Wert:Math.round((bf-1)*100*10)/10},
    {Einstellung:"LOW Führungen/Tag",Wert:A.levels().low},
    {Einstellung:"MEDIUM Führungen/Tag",Wert:A.levels().medium},
    {Einstellung:"HIGH Führungen/Tag",Wert:A.levels().high},
  ];
  const ws3=XLSX.utils.json_to_sheet(sRows);
  XLSX.utils.book_append_sheet(wb,ws3,"Einstellungen");
  XLSX.writeFile(wb,"Fuehrungen-"+state.currentYear+".xlsx");
}

// ---- PDF Export ----
function exportPdf(){
  if(!state.yearDays.length)return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF("p","mm","a4");
  const gs=A.groupSize(),dur=A.duration(),sDur=A.staffMin(),w=A.wage(),sv=A.svFactor(),bf=A.bufFactor();
  const vl=A.vorlauf(),nl=A.nachlauf();
  let tt=0,ad=0;state.yearDays.forEach(d=>{tt+=d.tours;if(d.tours>0)ad++;});
  const totalHrs=tt*sDur/60,totalCost=totalHrs*w;
  // Page 1: Übersicht
  doc.setFontSize(18);doc.setFont(undefined,"bold");
  doc.text("Besucher-Führungen-Rechner",14,20);
  doc.setFontSize(11);doc.setFont(undefined,"normal");
  doc.text("Jahresplanung "+state.currentYear+(state.currentState?" – "+A.BUNDESLAENDER[state.currentState]:""),14,28);
  // Einstellungen
  doc.autoTable({startY:34,head:[["Einstellung","Wert"]],body:[
    ["Jahr",String(state.currentYear)],
    ["Bundesland",state.currentState?A.BUNDESLAENDER[state.currentState]:"Bundesweit"],
    ["Gruppengröße",String(gs)],
    ["Dauer je Führung",dur+" Min."],
    ["Vorlaufzeit",vl+" Min."],
    ["Nachlaufzeit",nl+" Min."],
    ["Arbeitszeit je Führung",sDur+" Min."],
    ["Stundenlohn",A.formatEuro(w)],
    ["SV-Aufschlag",Math.round((sv-1)*100*10)/10+" %"],
    ["Puffer Krankheit/Urlaub",Math.round((bf-1)*100*10)/10+" %"],
    ["LOW",A.levels().low+" Führungen/Tag"],
    ["MEDIUM",A.levels().medium+" Führungen/Tag"],
    ["HIGH",A.levels().high+" Führungen/Tag"],
  ],theme:"grid",headStyles:{fillColor:[63,81,181]},styles:{fontSize:9},columnStyles:{0:{fontStyle:"bold"}},margin:{left:14,right:14}});
  // Jahresstatistik
  let y2=doc.lastAutoTable.finalY+8;
  doc.setFontSize(12);doc.setFont(undefined,"bold");doc.text("Jahresstatistik",14,y2);
  doc.autoTable({startY:y2+3,head:[["Kennzahl","Wert"]],body:[
    ["Führungen / Jahr",String(tt)],
    ["Gäste / Jahr",String(tt*gs)],
    ["MA-Stunden",A.formatHours(tt*sDur)],
    ["Führungstage",String(ad)],
    ["MA-Kosten (Brutto)",A.formatEuro(totalCost)],
    ["MA-Kosten + SV",A.formatEuro(totalCost*sv)],
    ["MA-Kosten + SV + Puffer",A.formatEuro(totalCost*sv*bf)],
  ],theme:"grid",headStyles:{fillColor:[63,81,181]},styles:{fontSize:9},columnStyles:{0:{fontStyle:"bold"}},margin:{left:14,right:14}});
  // Monatsübersicht
  const ms=A.getMonthlyStats();
  let y3=doc.lastAutoTable.finalY+8;
  doc.setFontSize(12);doc.setFont(undefined,"bold");doc.text("Monatsübersicht",14,y3);
  const mBody=ms.map((m,i)=>{const hrs=m.mins/60;return[A.MONTH_NAMES[i],m.tours,m.guests,m.days,A.formatHours(m.mins),A.formatEuro(hrs*w),A.formatEuro(hrs*w*sv),A.formatEuro(hrs*w*sv*bf)];});
  const sumT=ms.reduce((s,m)=>s+m.tours,0),sumG=ms.reduce((s,m)=>s+m.guests,0),sumD=ms.reduce((s,m)=>s+m.days,0),sumM=ms.reduce((s,m)=>s+m.mins,0);
  const sumH=sumM/60;mBody.push(["GESAMT",sumT,sumG,sumD,A.formatHours(sumM),A.formatEuro(sumH*w),A.formatEuro(sumH*w*sv),A.formatEuro(sumH*w*sv*bf)]);
  doc.autoTable({startY:y3+3,head:[["Monat","Führ.","Gäste","Tage","Std.","Kosten","+ SV","+ SV + Puffer"]],body:mBody,theme:"grid",headStyles:{fillColor:[63,81,181]},styles:{fontSize:8,halign:"right"},columnStyles:{0:{halign:"left",fontStyle:"bold"}},margin:{left:14,right:14},didParseCell:function(data){if(data.row.index===mBody.length-1){data.cell.styles.fontStyle="bold";data.cell.styles.fillColor=[232,234,246];}}});
  // Monatsseiten
  for(let mi=0;mi<12;mi++){
    const mDays=state.yearDays.filter(d=>d.date.getMonth()===mi);
    if(!mDays.length)continue;
    doc.addPage();
    doc.setFontSize(14);doc.setFont(undefined,"bold");
    doc.text(A.MONTH_NAMES[mi]+" "+state.currentYear,14,18);
    const mst=ms[mi];const mhrs=mst.mins/60;
    doc.setFontSize(9);doc.setFont(undefined,"normal");
    doc.text(mst.tours+" Führungen · "+mst.guests+" Gäste · "+mst.days+" Tage · "+A.formatHours(mst.mins)+" · Kosten: "+A.formatEuro(mhrs*w*sv*bf),14,25);
    const body=mDays.map(d=>{
      const hol=(d.ph&&d.sh)?d.ph+" / "+d.sh:d.ph||d.sh||"";
      const lvl=d.level==="none"?"–":d.level==="custom"?"Manuell":d.level.toUpperCase();
      return[A.formatDate(d.date),A.DOW_SHORT[d.dow],hol,lvl,d.tours||"",d.tours?d.tours*gs:"",d.tours?A.formatHours(d.tours*sDur):"",d.notes];
    });
    doc.autoTable({startY:30,head:[["Datum","Tag","Feiertag/Ferien","Ausl.","Führ.","Gäste","Std.","Notizen"]],body:body,theme:"striped",headStyles:{fillColor:[48,63,159]},styles:{fontSize:7.5,cellPadding:1.5},columnStyles:{0:{cellWidth:22},1:{cellWidth:10},2:{cellWidth:42},3:{cellWidth:18},4:{cellWidth:12,halign:"center"},5:{cellWidth:14,halign:"right"},6:{cellWidth:16,halign:"right"},7:{cellWidth:40}},margin:{left:10,right:10},didParseCell:function(data){if(data.section==="body"){const d=mDays[data.row.index];if(!d)return;if(d.ph)data.cell.styles.fillColor=[254,226,226];else if(d.sh)data.cell.styles.fillColor=[254,243,199];else if(d.dow===0||d.dow===6)data.cell.styles.fillColor=[255,247,237];}}});
  }
  doc.save("Fuehrungen-"+state.currentYear+".pdf");
}

// ---- Projekt speichern ----
function saveProject(){
  const data={version:2,settings:{year:A.clampInt($("yearSelect").value,2000,2099),state:$("stateSelect").value,groupSize:A.clampInt($("groupSize").value,1,200),tourDuration:A.clampInt($("tourDuration").value,5,600),prepTime:A.clampInt($("prepTime").value,0,120),followTime:A.clampInt($("followTime").value,0,120),levelLow:A.clampInt($("levelLow").value,0,50),levelMedium:A.clampInt($("levelMedium").value,0,50),levelHigh:A.clampInt($("levelHigh").value,0,50),hourlyWage:A.clampFloat($("hourlyWage").value,0,999),svRate:A.clampFloat($("svRate").value,0,100),bufferRate:A.clampFloat($("bufferRate").value,0,100),excludeHolidays:$("excludeHolidays").checked},weekTours:Object.assign({},state.weekTours),publicMap:Object.assign({},state.publicMap),schoolMap:Object.assign({},state.schoolMap),yearDays:state.yearDays.map(d=>({key:d.key,tours:d.tours,level:d.level,notes:d.notes}))};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  const stLabel=data.settings.state||"bundesweit";
  a.download="Fuehrungen-"+data.settings.year+"-"+stLabel+".json";
  a.click();URL.revokeObjectURL(a.href);
}

// ---- Projekt laden ----
function loadProject(file){
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=JSON.parse(e.target.result);
      if(!data.version||!data.settings){A.setInfo("Ungültige Projektdatei.","error");return;}
      const s=data.settings;
      $("yearSelect").value=s.year||2026;
      $("stateSelect").value=s.state||"";
      $("groupSize").value=s.groupSize||15;
      $("tourDuration").value=s.tourDuration||60;
      $("prepTime").value=s.prepTime!=null?s.prepTime:0;
      $("followTime").value=s.followTime!=null?s.followTime:0;
      $("levelLow").value=s.levelLow!=null?s.levelLow:2;
      $("levelMedium").value=s.levelMedium!=null?s.levelMedium:4;
      $("levelHigh").value=s.levelHigh!=null?s.levelHigh:6;
      $("hourlyWage").value=s.hourlyWage!=null?s.hourlyWage:15;
      $("svRate").value=s.svRate!=null?s.svRate:20;
      $("bufferRate").value=s.bufferRate!=null?s.bufferRate:25;
      $("excludeHolidays").checked=s.excludeHolidays!==false;
      if(data.weekTours)Object.assign(state.weekTours,data.weekTours);
      A.renderWeek();
      if(data.publicMap)state.publicMap=data.publicMap;
      if(data.schoolMap)state.schoolMap=data.schoolMap;
      if(data.yearDays&&data.yearDays.length){
        state.currentYear=s.year;state.currentState=s.state||"";
        A.buildYearDays(s.year);
        const saved={};data.yearDays.forEach(d=>{saved[d.key]=d;});
        state.yearDays.forEach(d=>{
          const sv=saved[d.key];
          if(sv){d.tours=sv.tours||0;d.level=sv.level||A.inferLevel(d.tours);d.notes=sv.notes||"";}
          d.ph=state.publicMap[d.key]||"";d.sh=state.schoolMap[d.key]||"";
        });
        A.renderYearTable();A.renderYearKpis();A.renderMonthly();
        state.generated=true;$("exportActions").hidden=false;
        A.switchView("year");
      }
      A.setInfo("Projekt geladen: "+file.name,"success");
    }catch(err){A.setInfo("Fehler beim Laden: "+err.message,"error");}
  };
  reader.readAsText(file);
}

// ---- Bindings ----
$("exportExcelBtn").addEventListener("click",exportExcel);
$("exportPdfBtn").addEventListener("click",exportPdf);
$("saveProjectBtn").addEventListener("click",saveProject);
$("loadProjectBtn").addEventListener("click",()=>$("loadFileInput").click());
$("loadFileInput").addEventListener("change",e=>{if(e.target.files[0])loadProject(e.target.files[0]);e.target.value="";});
})();
