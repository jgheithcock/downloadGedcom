// content.js
// Add a download GEDCOM button after the source person's name.

function createMutationObserver() {
  // create a Mutation Observer on the <h1> that will contain the nameSpan
  // if not already created, and name span shows up, create the download btn.
  const root = document.getElementById("root");
  const config = { attributes: false, childList: true, subtree: true };
  const callback = (mutationList, observer) => {
    console.log(`mutation list: ${mutationList[0].type}`);
    if (document.getElementById("download_ged")) return;
    const nameSpan = document.querySelector('[data-testid="fullName"]');
    if (nameSpan) addDownloadButton();
  };

  const observer = new MutationObserver(callback);
  observer.observe(root, config);
}
createMutationObserver();

function addDownloadButton() {
  if (document.getElementById("download_ged")) return;
  const nameSpan = document.querySelector('[data-testid="fullName"]');
  if (!nameSpan) return;
  const badge = document.createElement("a");
  badge.id = "download_ged";
  badge.style =
    "display:inline-block; margin-left:.25em; cursor:pointer; opacity:0.25";
  badge.title = `Download GED file for ${nameSpan.innerText}`;
  badge.innerText = "⬇️";
  badge.onclick = () => {
    if (!document.URL.includes("details/")) {
      alert(
        "Downloading GEDCOM data is only available on the Details tab of a FamilySearch person's page."
      );
    } else {
      const family = new FamilyCard();
      downloadFile(`${family.source.title}.ged`, new Gedcom(family));
    }
  };
  nameSpan.appendChild(badge);
}

class FamilyCard {
  static elementForField(selectorTags, src = document) {
    if (!selectorTags) return null;
    // construct selector
    const sel = selectorTags.map((f) => `[data-testid="${f}"]`).join(" ");
    return src.querySelector(sel);
  }

  static elementsForFieldAll(selectorTags, src = document) {
    if (!selectorTags) return null;
    // construct selector
    const sel = selectorTags.map((f) => `[data-testid="${f}"]`).join(" ");
    return src.querySelectorAll(sel);
  }

  static jsonForField(fld, src) {
    // returns string or object representing fld, found in source DOM
    // special-case gender as it doesn't work with selectorTags
    if (fld.type === "gender") return FamilyCard.scrapeGender(src);
    const el = FamilyCard.elementForField(fld.selectorTags, src);
    if (!el) return "";
    if (fld.type === "event") return FamilyCard.scrapeFields("event", el);
    return el.innerText; // default fld.type is 'text'
  }

  static scrapeFields(fieldType, src) {
    // fieldTypes (e.g. 'person', 'event', 'vitals') define how to scrape
    // data from a FamilySearch person's detail page and return an object
    // with the formatted data.
    // `tagName` - key used to store the formatted, scraped data
    // `type` - used to further scrape elements to break down sub-records
    // `selectorTags` hold the information used to scrape the page
    // c.f. elementForField(), jsonForField()
    const fieldTypes = {
      event: [
        { tagName: "date", type: "text", selectorTags: ["conclusion-date"] },
        { tagName: "place", type: "text", selectorTags: ["conclusion-place"] },
      ],
      person: [
        { tagName: "fullname", type: "text", selectorTags: ["fullName"] },
        { tagName: "lifespan", type: "text", selectorTags: ["lifespan"] },
        { tagName: "gender", type: "gender" },
        { tagName: "pID", type: "text", selectorTags: ["pid"] },
      ],
      vitals: [
        {
          tagName: "fullname",
          type: "text",
          selectorTags: ["conclusionDisplay:NAME", "conclusion-body"],
        },
        {
          tagName: "gender",
          type: "text",
          selectorTags: ["conclusionDisplay:GENDER", "conclusion-gender"],
        },
        {
          tagName: "birth",
          type: "event",
          selectorTags: ["conclusionDisplay:BIRTH"],
        },
        {
          tagName: "christening",
          type: "event",
          selectorTags: ["conclusionDisplay:CHRISTENING"],
        },
        {
          tagName: "death",
          type: "event",
          selectorTags: ["conclusionDisplay:DEATH"],
        },
        {
          tagName: "burial",
          type: "event",
          selectorTags: ["conclusionDisplay:BURIAL"],
        },
      ],
    };
    const flds = fieldTypes[fieldType];
    const obj = {};
    flds.map((fld) => (obj[fld.tagName] = FamilyCard.jsonForField(fld, src)));
    if (Object.values(obj).join("") === "") return null; // for empty objects
    return obj;
  }

  static scrapeGender(src) {
    const sentenceCase = (str) =>
      str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

    // Special case gender. Source person uses 'data-gender' attribute
    // Others have a div with either style="background: var(--blue30);" (Male)
    // or style="background: var(--red50);" (Female)
    const genderAttrb = src.querySelector("[data-gender]");
    if (genderAttrb)
      return sentenceCase(genderAttrb.getAttribute("data-gender"));
    const maleDiv = src.querySelector('[style="background: var(--blue30);"]');
    return maleDiv ? "Male" : "Female";
  }

  // Private utility methods
  #addPerson({ pID, ...info }) {
    if (!pID || pID === "") return; // not valid
    if (this.people.includes(pID)) {
      // just update family info and lifespan, do not overwrite birth, etc
      const { partnerIn, childOf, lifespan } = info;
      if (partnerIn) {
        if (!this.peopleMap[pID].partnerIn) this.peopleMap[pID].partnerIn = [];
        this.peopleMap[pID].partnerIn.push(...partnerIn);
      }
      if (childOf) {
        if (!this.peopleMap[pID].childOf) this.peopleMap[pID].childOf = [];
        this.peopleMap[pID].childOf.push(...childOf);
      }
      if (lifespan) this.peopleMap[pID].lifespan = lifespan;
      return;
    }
    this.peopleMap[pID] = { pID, ...info };
    this.people.push(pID);
  }

  #addFamily({ husband, wife, marriage, children }) {
    const familyID = `${husband.pID}_${wife.pID}`;
    if (this.families.includes(familyID)) return;
    this.familyMap[familyID] = {
      marriage,
      husband: husband.pID,
      wife: wife.pID,
      children: children.map((child) => child.pID),
    };
    this.families.push(familyID);

    // add individuals
    this.#addPerson({ ...husband, partnerIn: [familyID] });
    this.#addPerson({ ...wife, partnerIn: [familyID] });
    children.forEach((child) =>
      this.#addPerson({ ...child, childOf: [familyID] })
    );
  }

  #scrapeFamily(familyNode) {
    if (!familyNode) return;
    const [husbandNode, sep, wifeNode, marriageNode] = familyNode.childNodes;
    const husband = FamilyCard.scrapeFields("person", husbandNode);
    const wife = FamilyCard.scrapeFields("person", wifeNode);
    // technically, GEDCOM supports families with no parents (to group siblings)
    // but that makes the family ID not work and I've not seen this in practice.
    if (!husband.pID && !wife.pID) return; // need at least one
    const marriage = FamilyCard.scrapeFields("event", marriageNode);

    // Need to back up 4 parents to get to common div for children, if any
    const parNode = familyNode.parentNode.parentNode.parentNode.parentNode;
    const childrenTags = ["children-person-list"];
    const childrenNode = FamilyCard.elementForField(childrenTags, parNode);
    const children = [];
    if (childrenNode) {
      const familiesChildren = childrenNode.childNodes;
      // familiesChildren is a NodeList, and has no .map
      familiesChildren.forEach((child) =>
        children.push(FamilyCard.scrapeFields("person", child))
      );
    }

    this.#addFamily({ husband, wife, marriage, children });
  }

  #scrapeFamilyMembers() {
    // also scrapes individuals
    const familyTags = ["section-card-family", "couple-persons"];
    const families = FamilyCard.elementsForFieldAll(familyTags);
    families.forEach((family) => this.#scrapeFamily(family));
  }

  #familyToString; // private member for string formatter
  #gedcom; // private member for GEDCOM formatter
  constructor() {
    const pID = document.URL.split("details/")[1]; // pID at end of URL
    this.source = {
      title: document.title,
      url: document.URL,
      pID,
      dateViewed: new Date(),
    };
    this.peopleMap = {};
    this.people = [];
    this.familyMap = {};
    this.families = [];
    // vitals is used to create first person in list
    const vitals = FamilyCard.scrapeFields("vitals", document);
    this.#addPerson({ pID, ...vitals });
    this.#scrapeFamilyMembers();

    // fix up title to be <fullname>, <lifespan> (<FamilySearch ID>)
    this.source.title = FamilyToString.personToString(this.peopleMap[pID]);
    console.log(this.source.title);

    // create helper instances of formatting classes
    this.#familyToString = new FamilyToString(this);
    this.#gedcom = new Gedcom(this);
  }
  toString = () => `${this.#familyToString}`;
  toGedcom = () => `${this.#gedcom}`;
}

class FamilyToString {
  // for converting a family card object to plain text
  constructor(family) {
    this.family = family;
  }
  static shortToday(date) {
    // e.g. "Jun 27, 2024"
    const options = {
      day: "numeric",
      month: "short",
      year: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  }

  static eventToString(tag, evt) {
    if (!evt) return null;
    const strs = [`${tag}: ${evt.date}`];
    if (evt.place) strs.push(evt.place);
    return strs.join(", ");
  }

  static personToString(person) {
    if (!person) return null;
    let str = person.fullname;
    if (person.lifespan && person.lifespan.length > 0)
      str += ` (${person.lifespan},`;
    str += ` ${person.pID})`;
    return str;
  }

  static pushFamily(strs, family, peopleMap) {
    const { husband, wife, marriage, children } = family;
    strs.push(FamilyToString.personToString(peopleMap[husband]));
    strs.push(FamilyToString.personToString(peopleMap[wife]));
    strs.push(FamilyToString.eventToString("Married", marriage));
    if (children.length > 0) {
      strs.push("Children:");
      children.forEach((childID) =>
        strs.push("  " + FamilyToString.personToString(peopleMap[childID]))
      );
    }
    strs.push("");
  }
  toString() {
    const { source, people, peopleMap, families, familyMap } = this.family;
    const { title, url, pID, dateViewed } = source;
    const strs = [];
    strs.push(title);
    strs.push(url);
    strs.push(`Date viewed: ${FamilyToString.shortToday(dateViewed)}`);
    strs.push("");

    if (!pID) {
      return "No pID found in source from family for ${url}";
    }
    const sourcePerson = peopleMap[pID];
    strs.push(`Name: ${sourcePerson.fullname}`);
    strs.push(FamilyToString.eventToString("Birth", sourcePerson.birth));
    strs.push(
      FamilyToString.eventToString("Christening", sourcePerson.christening)
    );
    strs.push(FamilyToString.eventToString("Death", sourcePerson.death));
    strs.push(FamilyToString.eventToString("Burial", sourcePerson.burial));
    strs.push("");

    // Families
    const sourceFamilies = families.filter((famID) => famID.includes(pID));
    const parents = families.filter((famID) => !famID.includes(pID));
    if (sourceFamilies.length > 0) {
      strs.push("Families:");
      sourceFamilies.forEach((famID) =>
        FamilyToString.pushFamily(strs, familyMap[famID], peopleMap)
      );
    }
    if (parents.length > 0) {
      strs.push("Parents and Siblings:");
      parents.forEach((famID) =>
        FamilyToString.pushFamily(strs, familyMap[famID], peopleMap)
      );
    }

    // remove any nulls before joining lines
    return strs.filter((n) => typeof n === "string").join("\n");
  }
}

// for converting a family card object to GEDCOM

class Gedcom {
  constructor(family) {
    this.family = family;
    const { people, peopleMap, families, familyMap } = family;
    this.individuals = { list: [], dict: {} };
    this.fsIdsToGED = {};
    this.couples = { list: [], dict: {} };
    this.notes = { list: [], dict: {} }; // placeholder for now
    this.sources = { list: [], dict: {} }; // only FamilySearch page

    this.processPeople(people, peopleMap);
    this.processMarriages(families, familyMap);
    this.processSources(family);
    // add source to all individuals
    const genSrcID = this.sources.list[0];
    this.individuals.list.forEach((indID) => {
      this.individuals.dict[indID].push(`1 SOUR ${genSrcID}`);
    });
    return toString();
  }

  static gedDate(date) {
    // return <date> <abbreviated month> <year>. E.g. "28 Jun 2024"
    const shortMonth = date.toLocaleString("default", { month: "short" });
    return `${date.getDate()} ${shortMonth} ${date.getFullYear()}`;
  }

  processPeople(people, peopleMap) {
    people.forEach((pID) => {
      const indvId = `@I${this.individuals.list.length + 1}@`;
      this.fsIdsToGED[pID] = indvId;
      this.individuals.list.push(indvId);
      this.individuals.dict[indvId] = this.recsForPerson(
        indvId,
        peopleMap[pID]
      );
    });
  }
  processMarriages(families, familyMap) {
    families.forEach((pID) => {
      const coupleId = `@I${this.couples.list.length + 1}@`;
      this.fsIdsToGED[pID] = coupleId;
      this.couples.list.push(coupleId);
      this.couples.dict[coupleId] = this.recsForCouple(
        coupleId,
        familyMap[pID]
      );
    });
    // now that families have been created, add FAMC and FAMS records
  }
  processSources(family) {
    // Create single source from this URL's data
    const { source } = family;
    const sourceID = "@S1@";
    this.sources.list.push(sourceID);
    this.sources.dict[sourceID] = [
      `0 ${sourceID} SOUR`,
      `1 TYPE Web Site`,
      `1 TITL ${source.title}`,
      `1 URL ${source.url}`,
      `1 AUTH FamilySearch`,
      `1 DATV ${Gedcom.gedDate(source.dateViewed)}`,
    ];
    this.sources.dict[sourceID].push(
      ...this.textToGed(family.toString(), 1, "TEXT")
    );
  }

  // ### For testing:
  // s = document.body.innerText; //.replace(/(\r\n|\n|\r)/gm, "");
  // textToGed(s);
  textToGed(str, level = 1, tagName = "TEXT") {
    // return records for a Text record
    const textToCONC = (txt, level = 1, tagName = "CONT") => {
      // split text into 248 length line values (GEDCOM v.5.5.5)
      // this can contain lines with trailing or leading spaces
      const chunks = txt.match(/.{1,248}/g) || [""]; // handle blank line
      const recs = [`${level} ${tagName} ${chunks[0]}`];
      return recs.concat(chunks.slice(1).map((p) => `${level} CONC ${p}`));
    };
    const lines = str.split("\n");
    const recs = textToCONC(lines[0], level, tagName);
    for (let ndex = 1; ndex < lines.length; ndex++) {
      recs.push(...textToCONC(lines[ndex], level + 1, "CONT"));
    }

    return recs;
  }
  eventToGed(tagName, evt) {
    if (!evt) return [];
    const { date, place } = evt;
    if (!date && !place) return [];
    if (date === "Living") return [];
    const sanitizeDate = (dateString) => {
      // replace "about", "before", "after" with "ABT", "BEF", "AFT"
      const dayMonYrRegex = /(\d+) (\w+) (\d+)/;
      const match = dayMonYrRegex.exec(dateString);
      if (match) {
        // return date with abbreviated month
        const [orig, day, month, year] = match;
        return `${day} ${month.slice(0, 3)} ${year}`;
      }
      return dateString
        .replace(/about/gi, "ABT")
        .replace(/before/gi, "BEF")
        .replace(/after/gi, "AFT");
    };
    const recs = [];
    // DATE and PLAC are alway level 2 for events
    recs.push(`1 ${tagName}`);
    if (date) recs.push(`2 DATE ${sanitizeDate(evt.date)}`);
    if (place) recs.push(`2 PLAC ${place}`);
    return recs;
  }
  recsForPerson(indvId, person) {
    if (!person) return [];
    const nameFormatter = (fullName) => {
      // A poor man's version as the scraped name comes without any indictor
      // thus, this will return "John James /III/" making "III" the last name
      // As these GEDCOM files are just placeholders, to accelerate entry,
      // I'm leaving this as is.
      const words = fullName.split(" ");
      const first = words.slice(0, -1).join(" ");
      const last = words.slice(-1);
      return `${first} /${last}/`;
    };

    const recs = [];
    recs.push(`0 ${indvId} INDI`);
    const { fullname, lifespan, gender, pID } = person;
    recs.push(`1 NAME ${nameFormatter(fullname)}`);
    recs.push(`1 SEX ${gender[0]}`); // either "F" or "M"

    // add events
    let { birth, christening, death, burial } = person;
    if (lifespan && (!birth || !death)) {
      // use years from lifespan
      const [birthYr, deathYr] = lifespan.split("–"); // Note: em dash
      birth = { date: birthYr, ...birth };
      death = { date: deathYr, ...death };
    }
    recs.push(...this.eventToGed("BIRT", birth));
    recs.push(...this.eventToGed("CHR", christening));
    recs.push(...this.eventToGed("DEAT", death));
    recs.push(...this.eventToGed("BURI", burial));

    // add FamilySearch id as alternate User ID
    recs.push(`1 IDNO ${pID}`);
    recs.push("2 TYPE FamilySearch Person ID");
    recs.push(`1 REFN ${pID}`); // Only for Reunion - default User ID

    // Family records will be added later
    return recs;
  }
  recsForCouple(coupleId, family) {
    if (!family) return [];
    const { husband, wife, marriage, children } = family;

    const recs = [];
    recs.push(`0 ${coupleId} FAM`);
    if (husband) {
      const indID = this.fsIdsToGED[husband];
      recs.push(`1 HUSB ${indID}`);
      this.individuals.dict[indID].push(`1 FAMS ${coupleId}`);
    }
    if (wife) {
      const indID = this.fsIdsToGED[wife];
      recs.push(`1 WIFE ${indID}`);
      this.individuals.dict[indID].push(`1 FAMS ${coupleId}`);
    }
    recs.push(...this.eventToGed("MARR", marriage));
    if (children && children.length > 0) {
      children.forEach((pID) => {
        const indID = this.fsIdsToGED[pID];
        recs.push(`1 CHIL ${indID}`);
        this.individuals.dict[indID].push(`1 FAMC ${coupleId}`);
      });
    }

    return recs;
  }
  addCoupleToGed(marriage, vitals = null) {
    if (!marriage) return;
    const { husband, wife, married } = marriage;
    if (!husband || !wife) return;
    // add family
    const familyId = `${husband.pID}_${wife.pID}`;
    if (!this.gedMap.families[familyId]) this.gedMap.families[familyId] = {};
    this.gedMap.families[familyId] = {
      ...this.gedMap.families[familyId],
      husband: husband.pID,
      wife: wife.pID,
      married,
    };
  }
  gedHeader() {
    const dateViewed = Gedcom.gedDate(this.family.source.dateViewed);
    return [
      "0 HEAD",
      "1 SOUR FamilySearch",
      "2 CORP FamilySearch International",
      `1 DATE ${dateViewed}`,
      "1 SUBM @SUB1@",
      `1 FILE ${this.family.source.title}`,
      "1 GEDC",
      "2 VERS 5.5.1",
      "2 FORM LINEAGE-LINKED",
      "1 CHAR UTF-8",
    ];
  }
  gedTrailer() {
    return ["0 TRLR\n"];
  }
  gedIndividuals() {
    const recs = [];
    this.individuals.list.map((id) => recs.push(...this.individuals.dict[id]));
    return recs;
  }
  gedSubmitter() {
    return [
      "0 @SUB1@ SUBM",
      "1 NAME JG Heithcock",
      "1 ADDR 44 Westwind Rd",
      "2 CONT Lafayette, CA 94549",
      "1 WWW www.heithcock.com",
    ];
  }
  gedFamilies() {
    const recs = [];
    this.couples.list.map((id) => recs.push(...this.couples.dict[id]));
    return recs;
  }
  gedNotes() {
    return []; // TBD: Placeholder
  }
  gedSources() {
    const recs = [];
    this.sources.list.map((id) => recs.push(...this.sources.dict[id]));
    return recs;
  }
  toString() {
    // returns GEDCOM file contents (aka one GEDCOM record per line)
    const ged = [];
    ged.push(...this.gedHeader());
    ged.push(...this.gedIndividuals());
    ged.push(...this.gedSubmitter());
    ged.push(...this.gedFamilies());
    ged.push(...this.gedNotes());
    ged.push(...this.gedSources());
    ged.push(...this.gedTrailer());
    return ged.filter((n) => typeof n === "string").join("\n");
  }
}

// e.g. downloadFile("sample.txt", "Some sample text.");
const downloadFile = (fileName, content) => {
  const link = document.createElement("a");
  const file = new Blob([content], { type: "text/plain" });
  link.href = URL.createObjectURL(file);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};
