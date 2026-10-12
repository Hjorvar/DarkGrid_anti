---
name: encounter-design-rules
description: Meginreglur og kvaðir um leynd, vísbendingar og afhjúpun skrímsla í Darkgrid.
---

# Darkgrid — Encounter Design & Threat Secrecy Rules

Þetta skjal inniheldur opinbera hönnunar- og agent-reglu fyrir atburðakerfi (encounter system) í **Darkgrid**.

> [!IMPORTANT]
> **MEGINREGLA UM LEYND SKRÍMSLA:**
> **Leikmaður má ekki sjá nafn, mynd eða nákvæmar upplýsingar um skrímsli áður en hann hefur ákveðið að halda áfram með atburðinn.**
> 
> Þessi regla er ófrávíkjanleg og gildir um allar núverandi og framtíðarútfærslur á encounter- og bardagakerfinu.

---

## 1. Hugmyndafræði og leikjaupplifun (Core Philosophy)

Í drungalegum og hættulegum heimi Darkgrid er óvissan lykilþáttur í spennu og andrúmslofti:
- Leikmaður sem ferðast um óbyggðir eða rústir veit ekki fyrirfram hvaða óvættur býr í myrkrinu.
- Ef nafn og mynd skrímslis eru sýnd strax glatast óttinn við hið óþekkta, og leikmaður tekur ákvarðanir út frá leikjatölum (metagaming) í stað innlifunar.
- Ferlið skiptist því stranglega í tvö stig: **Fyrsta stig (Óþekkt ógn)** og **Annað stig (Afhjúpun)**.

---

## 2. Fyrsta stig: Óþekkt ógn (Initial Encounter)

Þegar hetja stígur á reit og atburður virkjast (eða kemur að virku skrímsli):

1. **Skrímslaval á bak við tjöldin:**
   - Serverinn velur skrímsli samkvæmt gildandi líkindareglum (Gaussian normaldreifing miðað við hetjustig og landsvæði).
   - Skráð er færsla í `encounters` með stöðunni `DISCOVERED`.
2. **Birting lýsingar:**
   - Birta skal eina af níu lýsingum skrímslisins úr SQLite (`1_distant`, eða `2_ranger_distant` ef hetjan er Ranger/Veiðimaður).
   - Lýsingin skal skapa óvissu og gefa vísbendingar (hljóð, lykt, ummerki, skuggar) án þess að afhjúpa skrímslið.
3. **Stranglega bannað að birta á Fyrsta stigi:**
   - **Ekkert nafn:** Nafn skrímslisins má hvorki birtast í meginmáli, fyrirsögnum, vísbendingum (`title`), `alt`-töggum né CSS-klösum.
   - **Engin mynd:** Handmáluð mynd skrímslisins birtist ekki. Í staðinn skal nota sérstakan dularfullan ógnarramma (`mystery frame`) með rún eða spurnarmerki sem gefur ekkert til kynna um tegundina.
   - **Ekkert tákn né einkennislitur:** Skrímslatákn (`symbol`) og litur (`color`) eru falin.
   - **Engar tölur:** HP, Challenge Rating (CR), skaði eða varnartölur eru stranglega ósýnileg.
4. **Ákvörðun leikmanns:**
   - Leikmaður verður að geta valið á milli:
     - **Halda áfram og rannsaka (Investigate):** Nálgast ógnina og færa sig yfir á Annað stig.
     - **Sniðganga og forðast (Ignore):** Forðast ógnina, loka atburðinum (`status = 'IGNORED'`) og halda ferð sinni áfram.
   - Ferðastýringar (áttaviti) eru læstar á meðan ákvörðun hefur ekki verið tekin.

---

## 3. Annað stig: Afhjúpun (Reveal)

Þegar leikmaður velur að halda áfram og rannsaka ógnina:

1. **Afhjúpun:**
   - Atburður færist í stöðuna `IN_COMBAT`.
   - **Sama skrímsli er notað:** Ekki má velja nýtt handahófsskrímsli eða breyta frumvali.
2. **Sjónræn birting:**
   - Nafn skrímslisins er afhjúpað í fyrirsögn.
   - Handmáluð 2D myndskreyting birtist í 1:1 ramma (`.monster-art-frame`).
   - Skrímslatákn (`symbol`) og litur eru sýnd.
   - Nákvæmari návígislýsing birtist (`3_close`, eða `4_ranger_close` fyrir Ranger).
3. **Áframhaldandi flæði:**
   - Leikurinn heldur áfram í samræmi við gildandi leikreglur (í Phase 1: návígisstaða með valkosti um að hörfa varlega; í Phase 2: d20 bardagi).
   - Ekki búa til nýjar bardagareglur án sérstaks samþykkis.

---

## 4. Kvaðir við gerð textalýsinga (Monster Descriptions)

Allar skrímslalýsingar í gagnagrunni skulu virða leyndina:
- `1_distant`: Má **aldrei** innihalda nafn skrímslisins eða ótvírætt heiti þess. Leggja skal áherslu á skynhrif (hreyfing í laufi, daunillan þef, brak í beinum, titring í jörðu).
- `2_ranger_distant`: Veitir Veiðimanni sérstaka vitsmunalega eða reynslumiðaða vísbendingu (fann slóð, þekkir merki um holdætu, sér brotin tré), en má **ekki** kalla skrímslið fullu nafni.

---

## 5. Tæknilegar kvaðir (Technical Integrity)

- **Server-Side Truth:** Ákvörðun um hvort skrímsli er afhjúpað stjórnast af stöðu atburðar (`encounters.status === 'IN_COMBAT'`).
- **Enginn gagnagrunnsleki til viðmóts:** EJS sniðmát mega aldrei prenta `monster_name`, `imageUrl`, né `symbol` í HTML-kóðann á Fyrsta stigi.
- **Endurhleðsla síðu (Page Refresh):** Ef leikmaður endurhleður síðunni á Fyrsta stigi skal atburðurinn haldast óafhjúpaður.
