import type { UiLang } from "./types.js";

/**
 * All bot copy lives here. English is the source of truth; every other language must have every key
 * (TypeScript enforces it).
 *
 * ⚠️ The isiZulu strings are a first draft. Have a first-language speaker review them before real users see them.
 * Keep messages short: WhatsApp messages are read on small screens, and every message we send costs money.
 */
const en = {
  welcome:
    "Hi! 👋 I'm CV Ready. I'll help you make a free, professional CV in about 10 minutes.\n\nWhich language do you prefer?",
  btn_choose_language: "Choose language",
  lang_fallback: "We're still translating into {lang}, so we'll use English for now. Sorry about that!",

  consent:
    "Before we start 🔒\n\nWe'll save your answers only to build your CV. We never sell your information.\n\nYou can type DELETE at any time to erase everything.",
  consent_more:
    "What we save: your name, area, phone number, education, work history, skills and references.\nWhy: to make and update your CV.\nWho sees it: only you, unless you later choose to share your CV with employers.\nHow long: until you type DELETE.",
  btn_agree: "✅ I agree",
  btn_read_more: "Read more",
  btn_no_thanks: "No thanks",
  consent_declined: "No problem, nothing was saved. Say Hi any time if you change your mind. 👋",

  ask_first_name: "Great, let's begin! 📝\n\nWhat is your *first name*?",
  ask_surname: "And your *surname*?",
  ask_area: "Which *area* do you live in?\nExample: Soweto, Gauteng",
  ask_email: "What is your *email address*?\nTap Skip if you don't have one.",
  btn_skip: "Skip",
  invalid_name: "That doesn't look right. Please type it again (letters only).",
  invalid_email: "That email doesn't look right. Please check it, or tap Skip.",

  ask_matric: "Did you finish *matric* (Grade 12)?",
  btn_yes: "Yes",
  btn_no: "No",
  btn_studying: "Still studying",
  ask_school: "Which *school* did you go to?",
  ask_year: "Which *year* did you finish? Example: 2021",
  ask_year_studying: "Which *year* will you finish? Example: 2027",
  invalid_year: "Please type a year with 4 numbers, like 2021.",
  ask_highest_grade: "What is the *highest grade* you passed? Example: Grade 10",
  ask_extra: "Do you have any other *courses or certificates*?\nExample: First Aid Level 1, PSIRA Grade C, a learnership",
  btn_add: "+ Add",
  btn_continue: "No, continue",
  ask_extra_name: "What is the course or certificate called?",
  ask_extra_year: "Which year did you get it? Tap Skip if you're not sure.",

  ask_exp_has:
    "Now your *work experience* 💼\n\nHave you worked before? Piece jobs, volunteering and helping in a family business all count!",
  ask_exp_title: "What was your *job or role*?\nExample: Car wash attendant",
  ask_exp_place: "*Where* did you work? Business name and area.\nExample: Maponya Mall, Soweto",
  ask_exp_dates: "*When* did you work there?\nExample: 2023 - 2025, or 2024 - now",
  invalid_dates: "Please include at least one year, like: 2023 - 2025",
  ask_exp_description:
    "Tell me what you *did* there, in your own words. Don't worry about perfect English, we'll make it sound professional.",
  exp_saved: "Saved ✅ *{title}*\n\nDo you want to add another job?",
  btn_add_another: "+ Add another",
  exp_none: "No problem! Lots of people are looking for their first job. We'll focus on your skills. 💪",
  exp_max: "That's {max} jobs, which is plenty for one CV. Let's move on.",

  ask_skills:
    "What are your *skills*? Type them separated by commas.\n\nIdeas: customer service, cash handling, teamwork, computer literacy, driver's licence (Code 10), cooking, cleaning",
  invalid_skills: "Please type at least one skill.",

  ask_refs: "Almost done! 🙌\n\nDo you have people who can *recommend* you (references)? A past boss, teacher or pastor works well.",
  btn_add_ref: "+ Add reference",
  btn_on_request: "On request",
  ask_ref_name: "What is their *full name*?",
  ask_ref_phone: "What is their *phone number*?",
  invalid_phone: "Please type a South African number, like 072 123 4567.",
  ask_ref_relation: "How do they know you?\nExample: Former manager at Maponya Car Wash",
  ref_saved: "Saved ✅ *{name}*\n\nAdd another reference?",
  btn_done: "Done",
  ref_max: "Two references is perfect. Let's finish up.",

  review_header: "🎉 Your CV details are complete, {name}!",
  review_footer:
    "Your PDF CV is coming in the next version of CV Ready.\n\nType *EDIT* to change something, or *DELETE* to remove your details.",
  edit_menu: "What would you like to change?",
  btn_choose_section: "Choose section",
  section_details: "Personal details",
  section_education: "Education",
  section_experience: "Work experience",
  section_skills: "Skills",
  section_references: "References",
  section_language: "Language",
  edit_hint: "We'll replace your old answers for this section.",

  delete_confirm: "⚠️ This will permanently delete all your details. Are you sure?",
  btn_delete_yes: "Yes, delete",
  btn_delete_no: "No, keep it",
  deleted: "Done. All your details have been deleted. Say Hi any time to start again. 👋",
  delete_cancelled: "Okay, nothing was deleted.",

  help:
    "Commands you can type at any time:\n*EDIT* change a section\n*RESTART* start your CV again\n*DELETE* erase all your details\n*HELP* show this message",
  restarting: "Okay, let's start your CV again.",
  voice_not_yet: "Voice notes are coming soon 🎤 Please type your answer for now.",
  unsupported: "Sorry, I can only read text and button taps for now.",
  use_buttons: "Please tap one of the options below. 👇",
  need_consent_first: "We need to finish the first steps before you can do that.",

  label_phone: "Phone",
  label_area: "Area",
  label_email: "Email",
  label_matric: "Matric",
  label_highest_grade: "Highest grade",
  label_other: "Other",
  label_on_request: "Available on request",
  label_none: "None yet",
  matric_completed: "Completed",
  matric_studying: "In progress",
};

export type MsgKey = keyof typeof en;

const zu: Record<MsgKey, string> = {
  welcome:
    "Sawubona! 👋 NginguCV Ready. Ngizokusiza wenze i-CV yamahhala, esezingeni eliphezulu, emizuzwini engaba ngu-10.\n\nUthanda ukusebenzisa luphi ulimi?",
  btn_choose_language: "Khetha ulimi",
  lang_fallback: "Sisahumushela ku-{lang}, ngakho sizosebenzisa isiNgisi okwamanje. Uxolo!",

  consent:
    "Ngaphambi kokuthi siqale 🔒\n\nSizogcina izimpendulo zakho ukuze sakhe i-CV yakho kuphela. Asiyithengisi imininingwane yakho.\n\nBhala SUSA noma nini ukusula konke.",
  consent_more:
    "Esikugcinayo: igama lakho, indawo, inombolo yocingo, imfundo, umlando womsebenzi, amakhono nabantu abakuncomayo.\nKungani: ukwenza nokubuyekeza i-CV yakho.\nObona yona: nguwe kuphela, ngaphandle uma ukhetha ukwabelana nabaqashi.\nIsikhathi: kuze kube ubhala SUSA.",
  btn_agree: "✅ Ngiyavuma",
  btn_read_more: "Funda kabanzi",
  btn_no_thanks: "Cha ngiyabonga",
  consent_declined: "Kulungile, akukho okugciniwe. Sho uthi Sawubona noma nini uma ushintsha umqondo. 👋",

  ask_first_name: "Kuhle, ake siqale! 📝\n\nYini *igama* lakho?",
  ask_surname: "Futhi *isibongo* sakho?",
  ask_area: "Uhlala kuyiphi *indawo*?\nIsibonelo: Soweto, Gauteng",
  ask_email: "Yini *i-imeyili* yakho?\nCindezela Yeqa uma ungenayo.",
  btn_skip: "Yeqa",
  invalid_name: "Lokho akubukeki kahle. Sicela uphinde ubhale (izinhlamvu kuphela).",
  invalid_email: "Le imeyili ayibukeki kahle. Sicela uyihlole, noma ucindezele Yeqa.",

  ask_matric: "Uqedile *uMatric* (Ibanga 12)?",
  btn_yes: "Yebo",
  btn_no: "Cha",
  btn_studying: "Ngisafunda",
  ask_school: "Wafunda kusiphi *isikole*?",
  ask_year: "Waqeda ngawuphi *unyaka*? Isibonelo: 2021",
  ask_year_studying: "Uzoqeda ngawuphi *unyaka*? Isibonelo: 2027",
  invalid_year: "Sicela ubhale unyaka ngezinombolo ezi-4, njengo-2021.",
  ask_highest_grade: "Yiliphi *ibanga eliphezulu* owaliphasa? Isibonelo: Ibanga 10",
  ask_extra: "Unazo ezinye *izifundo noma izitifiketi*?\nIsibonelo: First Aid Level 1, PSIRA Grade C, i-learnership",
  btn_add: "+ Engeza",
  btn_continue: "Cha, qhubeka",
  ask_extra_name: "Sibizwa ngokuthini lesi sifundo noma isitifiketi?",
  ask_extra_year: "Wasithola ngawuphi unyaka? Cindezela Yeqa uma ungaqiniseki.",

  ask_exp_has:
    "Manje *umsebenzi owake wawenza* 💼\n\nUke wasebenza? Ama-piece job, ukuvolontiya nokusiza ebhizinisini lomndeni konke kuyabalwa!",
  ask_exp_title: "Wawusebenza njengani?\nIsibonelo: Car wash attendant",
  ask_exp_place: "Wawusebenza *kuphi*? Igama lebhizinisi nendawo.\nIsibonelo: Maponya Mall, Soweto",
  ask_exp_dates: "Wasebenza nini lapho?\nIsibonelo: 2023 - 2025, noma 2024 - manje",
  invalid_dates: "Sicela ufake okungenani unyaka owodwa, njengo: 2023 - 2025",
  ask_exp_description:
    "Ngitshele ukuthi *wawenzani* lapho, ngamazwi akho. Ungakhathazeki ngesiNgisi esiphelele, sizokwenza kuzwakale kahle.",
  exp_saved: "Kugciniwe ✅ *{title}*\n\nUfuna ukwengeza omunye umsebenzi?",
  btn_add_another: "+ Engeza omunye",
  exp_none: "Akunankinga! Abantu abaningi bafuna umsebenzi wabo wokuqala. Sizogxila emakhonweni akho. 💪",
  exp_max: "Leyo yimisebenzi engu-{max}, yanele ku-CV eyodwa. Ake siqhubeke.",

  ask_skills:
    "Yimaphi *amakhono* akho? Wabhale uwahlukanise ngokhefana (,).\n\nIzibonelo: customer service, cash handling, teamwork, computer literacy, driver's licence (Code 10), ukupheka, ukuhlanza",
  invalid_skills: "Sicela ubhale okungenani ikhono elilodwa.",

  ask_refs: "Sesiyaqeda! 🙌\n\nUnabo abantu abangakuncoma (references)? Umphathi wakudala, uthisha noma umfundisi kuhle.",
  btn_add_ref: "+ Engeza umuntu",
  btn_on_request: "Uma becela",
  ask_ref_name: "Yini *igama eligcwele* lalowo muntu?",
  ask_ref_phone: "Yini *inombolo yocingo* yakhe?",
  invalid_phone: "Sicela ubhale inombolo yaseNingizimu Afrika, njengo-072 123 4567.",
  ask_ref_relation: "Ukwazi kanjani?\nIsibonelo: Owayengumphathi wami e-Maponya Car Wash",
  ref_saved: "Kugciniwe ✅ *{name}*\n\nEngeza omunye umuntu?",
  btn_done: "Sengiqedile",
  ref_max: "Abantu ababili banele. Ake siqede.",

  review_header: "🎉 Imininingwane ye-CV yakho isiphelele, {name}!",
  review_footer:
    "I-CV yakho ye-PDF izofika enguqulweni elandelayo ye-CV Ready.\n\nBhala *HLELA* ukushintsha okuthile, noma *SUSA* ukususa imininingwane yakho.",
  edit_menu: "Yini ofuna ukuyishintsha?",
  btn_choose_section: "Khetha ingxenye",
  section_details: "Imininingwane yakho",
  section_education: "Imfundo",
  section_experience: "Umsebenzi",
  section_skills: "Amakhono",
  section_references: "Abakuncomayo",
  section_language: "Ulimi",
  edit_hint: "Sizobuyisela izimpendulo zakho ezindala zale ngxenye.",

  delete_confirm: "⚠️ Lokhu kuzosusa yonke imininingwane yakho unomphela. Uqinisekile?",
  btn_delete_yes: "Yebo, susa",
  btn_delete_no: "Cha, yigcine",
  deleted: "Kwenziwe. Yonke imininingwane yakho isusiwe. Sho uthi Sawubona noma nini ukuze uqale kabusha. 👋",
  delete_cancelled: "Kulungile, akukho okususiwe.",

  help:
    "Imiyalo ongayibhala noma nini:\n*HLELA* shintsha ingxenye\n*QALA* qala i-CV yakho kabusha\n*SUSA* susa yonke imininingwane yakho\n*USIZO* bonisa lo mlayezo",
  restarting: "Kulungile, ake siqale i-CV yakho kabusha.",
  voice_not_yet: "Ama-voice note azofika maduze 🎤 Sicela ubhale impendulo yakho okwamanje.",
  unsupported: "Uxolo, okwamanje ngikwazi ukufunda umbhalo nokucindezela izinkinobho kuphela.",
  use_buttons: "Sicela ucindezele okukodwa kokungezansi. 👇",
  need_consent_first: "Kudingeka siqede izinyathelo zokuqala ngaphambi kokuthi wenze lokho.",

  label_phone: "Ucingo",
  label_area: "Indawo",
  label_email: "I-imeyili",
  label_matric: "Matric",
  label_highest_grade: "Ibanga eliphezulu",
  label_other: "Okunye",
  label_on_request: "Uma becela",
  label_none: "Akukabi bikho",
  matric_completed: "Uqediwe",
  matric_studying: "Usaqhubeka",
};

const catalogs: Record<UiLang, Record<MsgKey, string>> = { en, zu };

export function t(lang: UiLang, key: MsgKey, vars: Record<string, string | number> = {}): string {
  const template = catalogs[lang][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? `{${v}}`));
}

/** Languages offered on the first screen. `ui` is the language we can actually reply in today. */
export const LANGUAGES: Array<{ code: string; label: string; ui: UiLang }> = [
  { code: "en", label: "English", ui: "en" },
  { code: "zu", label: "isiZulu", ui: "zu" },
  { code: "xh", label: "isiXhosa", ui: "en" },
  { code: "st", label: "Sesotho", ui: "en" },
  { code: "tn", label: "Setswana", ui: "en" },
  { code: "af", label: "Afrikaans", ui: "en" },
];

/** Typed commands, accepted in any language at any point in the chat. */
export const COMMANDS: Record<string, "DELETE" | "EDIT" | "HELP" | "RESTART"> = {
  delete: "DELETE",
  susa: "DELETE",
  edit: "EDIT",
  hlela: "EDIT",
  help: "HELP",
  usizo: "HELP",
  restart: "RESTART",
  qala: "RESTART",
};
