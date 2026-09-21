// ================= SYSTÈME DE DIALOGUE (Leroy, Papi Feuillage...) =================
//
// COMPATIBILITÉ SPRITES (même principe que les bâtiments) :
// Tant que `portrait` vaut null ci-dessous, l'emoji de secours (`emoji`) est utilisé.
// Le jour où tu as le fichier du personnage, mets juste le chemin dans `portrait`
// (ex: 'assets/characters/leroy.png') — le reste du code n'a rien à changer.
const CHARACTERS = {
  leroy: { name: { fr: 'Leroy', en: 'Leroy' }, emoji: '🐸', color: '#8bc34a', portrait: 'assets/characters/leroy.png' },
  papi:  { name: { fr: 'Papi Feuillage', en: 'Gramps Weeds' }, emoji: '🐢', color: '#8d6e63', portrait: 'assets/characters/papi.png' },
};
function charName(characterId) {
  const c = CHARACTERS[characterId];
  if (!c) return characterId;
  return c.name[state.lang] || c.name.fr;
}

function getCharacterPortraitHtml(characterId) {
  const c = CHARACTERS[characterId] || { emoji: '❓', color: '#999', portrait: null };
  if (c.portrait) {
    return `<img src="${c.portrait}" alt="" onerror="this.parentElement.textContent='${c.emoji}'">`;
  }
  return c.emoji;
}

// ================= BIBLIOTHÈQUE DE RÉPLIQUES DE PAPI (pools par situation) =================
// Une phrase est tirée au hasard dans le pool correspondant à chaque déclenchement, en
// évitant de répéter immédiatement la même phrase deux fois de suite.
const PAPI_LINES = {
  randomVisit: {
    fr: [
      "Alors, toujours en vie ?",
      "Tu as dépensé de l'argent ? Sur ce terrain ? Ça alors.",
      "Ce n'est pas mal. Pour toi.",
      "Tiens, tu es encore debout.",
      "J'ai connu des terrains plus tristes que celui-là. Un ou deux.",
      "Ne me remercie pas. Surtout pas.",
      "Toujours là, toujours pareil.",
      "Ce terrain sent moins mauvais qu'avant. Ou alors, c'est toi.",
      "Je vais dire aux voisins que c'est moi qui t'ai tout appris.",
      "Ça devient presque un vrai terrain. Presque.",
      "Mon petit-fils, propriétaire terrien. Qui l'aurait cru.",
      "Je raconterai ça à tes enfants. S'il y en a un jour.",
      "On dirait presque que tu sais ce que tu fais. Presque.",
      "J'ai toujours su que tu avais ça en toi. Je mentais, mais bon.",
      "Je repasserai plus tard. Enfin, si j'ai le temps. J'ai un emploi du temps chargé, moi.",
      "C'est marrant, ce terrain a l'air plus grand à chaque fois que je le vois.",
      "Je passais dans le coin. Pur hasard.",
      "Ce n'est pas de la surveillance, c'est de l'intérêt familial.",
      "Ce n'est pas de la nostalgie, je vérifie juste que tu ne casses rien.",
      "Je n'étais pas inquiet. J'étais juste… dans le coin. Encore.",
      "Bramble m'a envoyé une carte postale de son bureau. Toi, tu n'as pas de bureau.",
      "Ton cousin, à ton âge, avait déjà trois terrains. Mais bon, chacun son rythme.",
      "Bramble a acheté un deuxième bureau. Et toi, tu as acheté quoi, déjà ?",
      "Ta cousine têtard a mangé un moustique entier ce matin. Productive, elle.",
      "Bramble m'a appelé. Depuis un yacht. Un yacht, Leroy.",
      "Même le têtard motivé en fait plus que toi. Et il ne fait rien.",
      "Je ne fais que passer. Comme d'habitude. Comme hier.",
      "Tu as déplacé cette pierre, ou je perds la tête ?",
      "Le voisin dit que ton terrain a de l'allure. Je lui ai dit de se taire.",
      "Alors, ça pousse ? Ne réponds pas, je vois bien.",
      "J'ai failli ne pas venir. Failli.",
      "Tu ne me demandes jamais comment je vais. C'est bien, continue.",
      "Il y a encore une grenouille qui dort dans ton seau.",
      "Je me demande ce que ce terrain pense de toi. Rien de bon, j'imagine.",
      "Tu sais que je compte les mauvaises herbes à chaque visite ? Non ? Tant mieux.",
      "Ne fais pas cette tête, je ne suis là que pour deux minutes. Ou trois heures.",
    ],
    en: [
      "Still alive, I see.",
      "You spent money? On this dump? Well, well.",
      "Not bad. For you.",
      "Huh, you're still standing.",
      "I've seen sadder plots than this. One or two.",
      "Don't thank me. Please don't.",
      "Still here, still the same.",
      "This land smells less bad than before. Or maybe that's you.",
      "I'm telling the neighbors I taught you everything.",
      "This is almost starting to look like actual land. Almost.",
      "My grandson, a landowner. Who would've guessed.",
      "I'll tell your kids about this. If you ever have any.",
      "You almost look like you know what you're doing. Almost.",
      "I always knew you had it in you. I was lying, but still.",
      "I'll come back later. If I have time. Some of us have busy schedules.",
      "Funny, this plot looks bigger every time I see it.",
      "I was just in the neighborhood. Pure coincidence.",
      "This isn't spying, it's family interest.",
      "It's not nostalgia, I'm just checking you haven't broken anything.",
      "I wasn't worried. I was just… in the area. Again.",
      "Bramble sent me a postcard from his office. You don't have an office.",
      "Your cousin had three plots by your age. But hey, everyone's got their own pace.",
      "Bramble bought a second office. What did you buy again?",
      "Your tadpole cousin ate a whole mosquito this morning. Productive, that one.",
      "Bramble called me. From a yacht. A yacht, Leroy.",
      "Even the motivated tadpole does more than you. And he does nothing.",
      "Just passing through. Like always. Like yesterday.",
      "Did you move that rock, or am I losing my mind?",
      "The neighbour says your land is looking sharp. I told him to be quiet.",
      "So, is it growing? Do not answer, I can see for myself.",
      "I almost did not come. Almost.",
      "You never ask how I am doing. Good, keep it that way.",
      "There is still a frog asleep in your bucket.",
      "I wonder what this land thinks of you. Nothing good, I imagine.",
      "You know I count the weeds on every visit? No? All the better.",
      "Do not pull that face, I am only here for two minutes. Or three hours.",
    ],
  },
  leaving: {
    fr: [
      "Bon, je file. Essaie de ne pas tout gâcher d'ici ma prochaine visite.",
      "Bon, j'y vais. Ne fais rien que je ne ferais pas. Ça te laisse de la marge.",
      "À la prochaine. Si tu es toujours là.",
      "Bon. J'ai d'autres petits-enfants à décevoir.",
      "Je reviendrai. C'est une promesse. Ou une menace. Au choix.",
      "Allez, je m'en vais. Le terrain a l'air de survivre, c'est déjà ça.",
      "Je te laisse. Essaie de ne pas m'appeler pour une histoire de limace.",
      "Voilà, j'ai vu ce que je voulais voir. Je repars.",
      "Je pars avant que tu me demandes un conseil.",
      "On se revoit bientôt. Trop tôt, sans doute.",
      "Je file, j'ai une réunion. Avec ma chaise.",
      "Bon, tu gères. Je n'ai jamais dit ça, d'ailleurs.",
      "Je m'en vais content. Ne t'habitue pas.",
      "Je rentre. Ne touche à rien de dangereux, c'est-à-dire à rien du tout.",
    ],
    en: [
      "Alright, I'm off. Try not to ruin everything before I'm back.",
      "Alright, I'm off. Don't do anything I wouldn't do. That leaves you plenty of room.",
      "See you next time. If you're still around.",
      "Alright. I've got other grandkids to disappoint.",
      "I'll be back. That's a promise. Or a threat. Your call.",
      "Right, I am off. The land seems to be surviving, that is something.",
      "I will leave you to it. Try not to call me about a slug.",
      "There, I have seen what I came to see. I am going.",
      "I am leaving before you ask me for advice.",
      "See you soon. Too soon, probably.",
      "I am off, I have a meeting. With my chair.",
      "Fine, you have got this. I never said that, by the way.",
      "I am leaving pleased. Do not get used to it.",
      "I am heading home. Do not touch anything dangerous, which means anything.",
    ],
  },
  bigUpgrade: {
    fr: [
      "Oh. Tu as réussi à faire quelque chose de bien. Il faut que je m'asseye, quel choc.",
      "Attends, c'est toi qui as fait ça ? Tout seul ?",
      "Bon, d'accord, ce n'est pas mal du tout. Ne répète à personne que j'ai dit ça.",
      "Tiens tiens. Un miracle est possible, apparemment.",
      "Je vais devoir revoir mes attentes. À la baisse… enfin, non, à la hausse. Bref.",
      "Alors ça… je l'avoue, je ne m'y attendais pas.",
      "Presque impressionnant. J'ai dit presque.",
      "Ça, c'est du sérieux. Presque du travail de grand-père.",
      "Je ne vais pas te féliciter. Voilà, c'est fait, je ne l'ai pas fait.",
      "Le terrain vient de changer de catégorie. Toi, pas encore.",
      "Quelqu'un t'a aidé ? Non ? Bon.",
      "Je crois que je viens d'avoir une bouffée de fierté. Ça passera.",
      "Si ta grand-mère voyait ça, elle dirait la même chose que moi. En plus gentil.",
      "Continue comme ça et je vais devoir t'inventer un compliment.",
    ],
    en: [
      "Oh. You actually did something right. I need to sit down, the shock.",
      "Wait, you did that? By yourself?",
      "Okay fine, that's actually pretty good. Don't repeat that I said it.",
      "Well, well. Miracles are possible, apparently.",
      "I'll have to reconsider my expectations. Lower them… no wait, raise them. Whatever.",
      "Well now… I'll admit, didn't see that coming.",
      "Almost impressive. I said almost.",
      "Now that is serious. Almost grandfather-grade work.",
      "I am not going to congratulate you. There, done, I did not do it.",
      "The land just moved up a class. You have not, yet.",
      "Did somebody help you? No? Fine.",
      "I think I just felt a wave of pride. It will pass.",
      "If your grandmother saw this, she would say the same as me. But nicer.",
      "Keep this up and I will have to invent a compliment for you.",
    ],
  },
  inactivity: {
    fr: [
      "Qu'est-ce que tu as fait depuis la dernière fois ? Rien ? Ça ne me surprend pas.",
      "Ce terrain a plus bougé pendant que je dormais que depuis que tu es réveillé.",
      "Je commence à me demander si je ne t'ai pas donné ce terrain par erreur.",
      "Le terrain s'ennuie. Moi aussi, d'ailleurs.",
      "À ce rythme, les mauvaises herbes vont te réclamer un loyer.",
      "Tu hibernes ou tu ne travailles pas ? Chez toi, je ne vois plus la différence.",
      "Ce terrain a connu plus d'action pendant l'orage d'hier que depuis que tu es là.",
      "Tu es toujours là ? Cligne des yeux si tu m'entends.",
      "J'ai vu un escargot traverser tout le terrain. Deux fois. Toi, rien.",
      "Le terrain a poussé sans toi. C'est vexant, non ?",
      "Je te laisse réfléchir. Prends ton temps. Visiblement, tu le prends.",
      "Tu médites, ou tu as oublié le jeu ouvert ?",
      "J'ai eu le temps de faire un mot croisé entier.",
      "Les grenouilles commencent à se demander qui commande ici.",
    ],
    en: [
      "What have you done since last time? Nothing? Shocking.",
      "This plot's moved more while I was asleep than while you're awake.",
      "I'm starting to wonder if I gave you this land by mistake.",
      "The land's bored. So am I, honestly.",
      "At this rate, the weeds are gonna start charging you rent.",
      "Are you hibernating or just not working, hard to tell with you.",
      "This land saw more action during yesterday's storm than since you got here.",
      "Still there? Blink if you can hear me.",
      "I watched a snail cross the whole plot. Twice. You did nothing.",
      "The land grew without you. Insulting, isn't it?",
      "I will let you think. Take your time. Clearly you are taking it.",
      "Are you meditating, or did you just leave the game open?",
      "I had time to finish an entire crossword.",
      "The frogs are starting to wonder who is in charge here.",
    ],
  },
  firstPurchase: {
    fr: [
      "Ta première dépense… Je suis presque ému. Presque.",
      "Regarde-toi, tu deviens un adulte responsable. Enfin, une grenouille responsable.",
      "Une dépense. Une vraie. Note la date.",
      "Tu as donné de l'argent à quelqu'un pour travailler. C'est ça, la vie d'adulte.",
      "Je croyais que tu gardais tout sous ton matelas. Bien joué.",
      "Voilà comment ça commence. Ensuite, on ne s'arrête plus.",
      "Ton premier employé. Sois gentil avec lui, il n'a pas demandé à être là.",
      "Tu as embauché. Je ne sais pas si je dois rire ou applaudir.",
    ],
    en: [
      "Your first purchase… I'm almost touched. Almost.",
      "Look at you, becoming a responsible adult. Well, a responsible frog.",
      "A purchase. A real one. Mark the date.",
      "You gave someone money to work. That is adult life right there.",
      "I thought you kept it all under your mattress. Well done.",
      "This is how it starts. After this, you never stop.",
      "Your first employee. Be kind to him, he did not ask to be here.",
      "You hired someone. I do not know whether to laugh or applaud.",
    ],
  },
  milestone: {
    fr: [
      "C'est officiel, tu me coûtes moins cher que prévu.",
      "Je vais devoir revoir mon opinion sur toi. Un petit peu. Très légèrement.",
      "Encore un palier. À ce rythme, tu vas finir par savoir faire quelque chose.",
      "Le terrain avance. Je surveille, je note.",
      "Tu progresses plus vite que mes rhumatismes. C'est un compliment.",
      "Bien. Ne t'arrête pas maintenant, ce serait dommage pour moi.",
      "Je commence à comprendre pourquoi je t'ai donné ce terrain. Un peu.",
      "Un palier de plus. Je vais devoir agrandir la liste de mes reproches.",
      "Tu tiens le rythme. C'est nouveau, chez toi.",
      "Ce terrain te ressemble de plus en plus. Il devient presque fréquentable.",
    ],
    en: [
      "It's official, you're costing me less than I expected.",
      "I might have to reconsider my opinion of you. Slightly. Very slightly.",
      "Another milestone. At this rate you might learn to do something.",
      "The land is moving forward. I am watching, I am taking notes.",
      "You are progressing faster than my rheumatism. That is a compliment.",
      "Good. Do not stop now, it would be a shame for me.",
      "I am starting to see why I gave you this land. A little.",
      "One more milestone. I will have to extend my list of complaints.",
      "You are keeping pace. That is new, for you.",
      "This land looks more like you every day. It is becoming almost respectable.",
    ],
  },
  hugeMilestone: {
    fr: [
      "Bon. Je vais devoir arrêter de dire à tout le monde que tu es un incapable. C'est vexant pour moi.",
      "Tu sais quoi, garde le terrain. J'en trouverai un autre.",
      "Bon. Peut-être que je te lègue le reste de mes terrains, finalement.",
      "Je vais devoir trouver une nouvelle victime à embêter. Enfin, presque.",
      "Bon. Là, je n'ai plus de réplique. Ça ne m'était pas arrivé depuis longtemps.",
      "Tu viens de dépasser ce que j'avais fait de ce terrain. Ne le répète pas.",
      "Je vais devoir m'asseoir et réviser toute mon opinion sur toi.",
      "Ton cousin Bramble ne saura jamais faire ça. Voilà, je l'ai dit.",
      "Ce n'est plus un terrain. C'est une affaire de famille sérieuse.",
      "J'ai raconté ça au voisin. Il ne m'a pas cru. Je le comprends.",
    ],
    en: [
      "Alright. I'm gonna have to stop telling everyone you're useless. This is embarrassing for me.",
      "You know what, keep the land. I'll find another one.",
      "Alright. Maybe I'll leave you the rest of my land after all.",
      "I'll have to find a new target to bother. Well, almost.",
      "Right. Now I am out of remarks. That has not happened in a long while.",
      "You just passed what I ever did with this land. Do not repeat that.",
      "I will have to sit down and revise my entire opinion of you.",
      "Your cousin Bramble will never manage this. There, I said it.",
      "This is not a plot of land any more. This is serious family business.",
      "I told the neighbour about this. He did not believe me. I understand him.",
    ],
  },
  bigPurchase: {
    fr: [
      "Ça, c'est cher. J'espère que tu sais ce que tu fais. Moi, je n'en sais rien.",
      "Tu as vraiment dépensé tout ça ? Sur un caprice de grenouille ?",
      "Tout ça pour ça ? Enfin, ce n'est pas mal, mais quand même.",
      "Tu as vidé tes économies. J'espère que ça valait le coup.",
      "À ce prix-là, j'espère que ça travaille la nuit aussi.",
      "Tu viens de dépenser en une fois ce que j'ai mis dix ans à économiser.",
      "Je n'ai pas regardé le prix. Menteur, je l'ai regardé.",
      "C'est énorme. Et tu as même l'air content de toi.",
      "Si ça ne marche pas, je ne te connais pas.",
      "Voilà ce que j'appelle un investissement. Ou une bêtise. On verra.",
    ],
    en: [
      "That's expensive. I hope you know what you're doing. I sure don't.",
      "You actually spent all that? On a frog's whim?",
      "All that for this? I mean, it's decent, but still.",
      "You emptied your savings. Hope it was worth it.",
      "At that price, I hope it works nights too.",
      "You just spent in one go what took me ten years to save.",
      "I did not look at the price. That is a lie, I looked.",
      "That is huge. And you even look pleased with yourself.",
      "If this does not work out, I do not know you.",
      "That is what I call an investment. Or a blunder. We shall see.",
    ],
  },
  randomUnrelated: {
    fr: [
      "J'ai vu une limace hier. Elle allait plus vite que toi.",
      "Tu savais que les crapauds vivent plus longtemps que les grenouilles ? Juste comme ça, en passant.",
      "J'ai parié sur toi avec un voisin. J'ai perdu. Merci pour ça.",
      "Un héron m'a regardé bizarrement ce matin. Je pense qu'il me connaît.",
      "J'ai retrouvé une vieille photo de moi quand j'étais jeune. J'étais terrifiant. Tant mieux.",
      "Il paraît qu'il va pleuvoir. Ou pas. Je m'en fiche un peu, en fait.",
      "J'ai croisé ta grand-mère en rêve. Elle m'a dit de te laisser tranquille. Je n'écoute pas.",
      "Le boulanger a changé sa farine. Je le sais, je l'ai senti.",
      "Il y a un crapaud, au village, qui chante faux. Tous les soirs.",
      "J'ai mal au dos depuis 1987. Ce n'est pas nouveau, mais je le dis.",
      "Ne mange jamais de champignon que tu n'as pas insulté d'abord.",
      "Mon voisin a repeint sa barrière en bleu. Un bleu discutable.",
      "J'ai rêvé que le terrain me parlait. Il se plaignait de toi.",
      "Les hérons connaissent mon prénom. Je ne sais pas comment.",
      "J'ai gagné un concours de silence, une fois. On m'a disqualifié pour avoir crié de joie.",
      "Un jour je te raconterai l'histoire du puits. Pas aujourd'hui.",
    ],
    en: [
      "Saw a slug yesterday. It was faster than you.",
      "Did you know toads outlive frogs? Just saying. No reason.",
      "I bet on you with a neighbor. I lost. Thanks for that.",
      "A heron gave me a weird look this morning. I think it knows me.",
      "Found an old photo of myself young. I was terrifying. Good.",
      "Apparently it's gonna rain. Or not. I don't really care, actually.",
      "I met your grandmother in a dream. She told me to leave you alone. I am not listening.",
      "The baker changed his flour. I know, I could smell it.",
      "There is a toad in the village that sings out of tune. Every evening.",
      "My back has hurt since 1987. Not news, but I am saying it.",
      "Never eat a mushroom you have not insulted first.",
      "My neighbour repainted his fence blue. A questionable blue.",
      "I dreamt the land was talking to me. It was complaining about you.",
      "The herons know my first name. I do not know how.",
      "I won a silence contest once. They disqualified me for shouting with joy.",
      "One day I will tell you the story of the well. Not today.",
    ],
  },
  quitGame: {
    fr: [
      "Tu pars déjà ? Le terrain ne t'attendra pas éternellement. Enfin si, en fait.",
      "File. Je surveille de toute façon.",
      "Tu pars sans dire au revoir ? Sans surprise, venant de toi.",
      "Bonne pause. Le terrain, lui, ne se repose jamais. Ni moi, d'ailleurs.",
      "Reviens vite. J'ai encore plein de choses à ne pas te dire.",
      "On se reverra. Malheureusement pour l'un de nous deux.",
      "Va, repose-toi. Le terrain fera le travail, comme toujours.",
      "Ferme bien derrière toi. Il y a des courants d'air, ici.",
      "Pars. Je vais en profiter pour tout déplacer de deux centimètres.",
      "À tout à l'heure. Ou à dans trois semaines. Je connais mon petit-fils.",
      "Je reste encore un peu. Quelqu'un doit surveiller.",
      "Dors bien. Moi, je ne dors plus vraiment depuis longtemps.",
    ],
    en: [
      "Leaving already? The land won't wait forever. Actually, it will. Never mind.",
      "Go on then. I'm watching either way.",
      "Leaving without saying goodbye? Not surprising, coming from you.",
      "Enjoy your break. The land never rests. Neither do I, actually.",
      "Come back soon. I've got plenty more things not to tell you.",
      "We'll meet again. Unfortunately, for one of us.",
      "Go on, get some rest. The land will do the work, as usual.",
      "Close the gate behind you. There are draughts around here.",
      "Off you go. I will use the time to move everything two centimetres.",
      "See you shortly. Or in three weeks. I know my grandson.",
      "I will stay a little longer. Someone has to keep watch.",
      "Sleep well. I have not really slept in years.",
    ],
  },
  returnAfterBreak: {
    fr: [
      "Tu reviens vite. Ou pas assez vite. Difficile à dire avec toi.",
      "Ah, te revoilà. Le terrain se demandait où tu étais passé. Moi, non.",
      "Te revoilà. J'ai gardé ta place. Personne ne la voulait.",
      "Tu es parti longtemps. Le terrain a survécu. Moi aussi, merci de demander.",
      "Ah, le revoilà. J'allais mettre une annonce.",
      "J'ai arrosé pendant ton absence. Ne me remercie pas, je l'ai mal fait exprès.",
      "Tu reviens. Les grenouilles vont être déçues, elles s'organisaient très bien.",
      "Je commençais à croire que tu avais trouvé un vrai travail.",
      "Bon retour. Rien n'a changé. C'est un peu triste, non ?",
      "Tu m'as manqué. Voilà, c'est dit, n'en parlons plus.",
    ],
    en: [
      "You're back fast. Or not fast enough. Hard to tell with you.",
      "Oh, there you are. The land was wondering where you went. I wasn't.",
      "There you are. I kept your spot. Nobody wanted it.",
      "You were gone a while. The land survived. So did I, thanks for asking.",
      "Ah, he is back. I was about to post a notice.",
      "I watered things while you were away. Do not thank me, I did it badly on purpose.",
      "You are back. The frogs will be disappointed, they were managing fine.",
      "I was starting to think you had found a real job.",
      "Welcome back. Nothing has changed. A bit sad, isn't it?",
      "I missed you. There, it is said, let us never mention it again.",
    ],
  },
  // Papi débarque sur le terrain et s'installe pour regarder par-dessus l'épaule (production -30 %).
  arrivee: {
    fr: [
      "Bon. Je m'installe. Fais comme si je n'étais pas là.",
      "Ne t'arrête pas pour moi. Continue, je regarde.",
      "Je viens vérifier deux ou trois choses. Trois, plutôt.",
      "Tiens, je vais rester un moment. Tu as l'air d'avoir besoin d'un public.",
      "Je me mets là. Ne fais pas attention à moi. C'est impossible, je sais.",
      "J'arrive au bon moment, on dirait. Au mauvais, pour toi.",
      "Alors, on travaille ? Montre-moi ça de plus près.",
      "Je passe l'inspection. Ce n'est pas officiel. Enfin, si.",
      "Ne sois pas nerveux. Tu es nerveux.",
      "Je reste jusqu'à ce que tu me prouves quelque chose.",
      "Fais-moi voir comment tu t'y prends. Depuis le début, oui.",
      "Je m'assois sur ta pierre. Elle est à moi aussi, techniquement.",
    ],
    en: [
      "Right. I am settling in. Pretend I am not here.",
      "Do not stop for me. Carry on, I am watching.",
      "I came to check two or three things. Three, rather.",
      "You know what, I will stay a while. You look like you need an audience.",
      "I will stand here. Pay me no attention. Impossible, I know.",
      "I arrive at the right moment, it seems. The wrong one, for you.",
      "So, working hard? Let me see that up close.",
      "This is an inspection. Not an official one. Well, yes it is.",
      "Do not be nervous. You are nervous.",
      "I am staying until you prove something to me.",
      "Show me how you go about it. From the start, yes.",
      "I am sitting on your rock. It is mine too, technically.",
    ],
  },
  // Juste après une Terraformation (Prestige).
  prestige: {
    fr: [
      "Tu as tout rasé. Volontairement. Je respecte ça.",
      "Recommencer à zéro, mais en mieux. C'est toute une philosophie.",
      "Le terrain est nu, et tu souris. Tu commences à comprendre.",
      "J'ai connu ça. On repart, on refait, on recommence. C'est le métier.",
      "Ces graines valent plus cher que tout ce que tu viens de perdre. Réfléchis-y.",
      "Tu as eu le courage de tout jeter. Ton cousin n'aurait jamais osé.",
      "Encore une vie de terrain derrière nous. Il en reste.",
    ],
    en: [
      "You flattened everything. On purpose. I respect that.",
      "Starting from nothing, but better. That is a whole philosophy.",
      "The land is bare and you are smiling. You are starting to understand.",
      "I know that feeling. You restart, you rebuild, you go again. That is the job.",
      "Those seeds are worth more than everything you just lost. Think about it.",
      "You had the nerve to throw it all away. Your cousin never would have.",
      "Another life of this land behind us. There are more to come.",
    ],
  },
  // Juste après une Ascension.
  ascension: {
    fr: [
      "Tu es monté plus haut que le terrain lui-même. Je ne sais pas quoi en penser.",
      "Des éclats d'étoile. Sur mon terrain. Enfin, ton terrain.",
      "Ta grand-mère parlait de ça, parfois. Je croyais qu'elle plaisantait.",
      "Tu as échangé tes graines contre le ciel. C'est un bon marché.",
      "Là, tu dépasses ce que j'avais prévu pour toi. Et de loin.",
      "Ce n'est plus du jardinage. Je ne sais pas ce que c'est, mais continue.",
    ],
    en: [
      "You climbed higher than the land itself. I do not know what to make of it.",
      "Stellar shards. On my land. Well, your land.",
      "Your grandmother used to mention this. I thought she was joking.",
      "You traded your seeds for the sky. That is a fair deal.",
      "Now you are going past anything I planned for you. By a long way.",
      "This is not gardening any more. I do not know what it is, but keep going.",
    ],
  },
  // Quand le temps tourne mal.
  meteo: {
    fr: [
      "Regarde-moi ce ciel. Il t'en veut personnellement.",
      "Ce n'est pas la météo, c'est un avertissement.",
      "Par ce temps-là, même les limaces restent chez elles.",
      "J'ai connu pire. En 62. On n'en parle pas.",
      "Ne t'inquiète pas, la terre aime ça. Toi, un peu moins.",
      "Couvre-toi. Non, je ne m'inquiète pas, je constate.",
      "Un temps pareil, ça forge un jardinier. Ou ça l'enterre.",
    ],
    en: [
      "Look at that sky. It has something against you personally.",
      "That is not weather, that is a warning.",
      "In weather like this, even the slugs stay home.",
      "I have seen worse. Back in 62. We do not talk about it.",
      "Do not worry, the soil loves this. You, rather less.",
      "Wrap up warm. No, I am not worried, I am observing.",
      "Weather like this makes a gardener. Or buries one.",
    ],
  },
  // Quand le joueur joue tard dans la nuit.
  nuit: {
    fr: [
      "Il est tard. Même les grenouilles dorment.",
      "Tu jardines à cette heure-ci ? Tu es bien mon petit-fils.",
      "La nuit, le terrain fait des bruits. Ne cherche pas d'où ils viennent.",
      "Va te coucher. Je dis ça, je ne dis rien, mais va te coucher.",
      "À cette heure, on ne voit plus les mauvaises herbes. Pratique.",
      "Moi aussi je veille. C'est de famille, apparemment.",
      "Le terrain est plus calme la nuit. Plus honnête, aussi.",
    ],
    en: [
      "It is late. Even the frogs are asleep.",
      "Gardening at this hour? You really are my grandson.",
      "At night, the land makes noises. Do not go looking for the source.",
      "Go to bed. I am not telling you what to do, but go to bed.",
      "At this hour you cannot see the weeds. Convenient.",
      "I stay up too. Runs in the family, apparently.",
      "The land is quieter at night. More honest, too.",
    ],
  },
  // Defis : au lancement et a la reussite.
  defi: {
    fr: [
      "Tu te compliques la vie volontairement. J'aime cette famille.",
      "Une règle en plus, et tu acceptes. Tu as pris un coup sur la tête ?",
      "Voilà une contrainte idiote. Donc intéressante.",
      "Si tu réussis ça, je t'offre un compliment. Un seul.",
      "Réussi. Bon. Je n'avais pas parié sur toi, tant mieux pour mon porte-monnaie.",
      "Tu as tenu jusqu'au bout. Note bien que je n'ai pas dit le contraire.",
    ],
    en: [
      "You are making life harder on purpose. I love this family.",
      "One more rule, and you agreed to it. Did you hit your head?",
      "Now there is a silly constraint. Which makes it interesting.",
      "If you pull this off, I will give you a compliment. One.",
      "Done. Fine. I had not bet on you, which is good for my wallet.",
      "You saw it through. Note that I never said otherwise.",
    ],
  },
  // Quand le joueur choisit un familier.
  familier: {
    fr: [
      "Tu as un animal de compagnie. Il travaille, lui, au moins ?",
      "Fais attention à lui. Il a l'air plus fiable que toi.",
      "Ta grand-mère avait un escargot. Il a vécu plus vieux qu'elle ne l'espérait.",
      "Bien choisi. Ne lui donne pas de nom, ça complique tout.",
      "Un compagnon sur le terrain. Ça faisait longtemps.",
    ],
    en: [
      "You have a pet. Does it work, at least?",
      "Look after it. It seems more reliable than you.",
      "Your grandmother had a snail. It lived longer than she expected.",
      "Good choice. Do not give it a name, that complicates everything.",
      "A companion on the land. It has been a while.",
    ],
  },
  // Quand le joueur declenche une capacite.
  capacite: {
    fr: [
      "Voilà, tu utilises tes outils. Ça a mis le temps.",
      "Joli coup. Ne prends pas l'habitude de te reposer dessus.",
      "C'est pour ça que tu l'as acheté, alors sers-t'en.",
      "Tu vois quand tu veux. Enfin, quand tu veux bien.",
    ],
    en: [
      "There, you are using your tools. It took you long enough.",
      "Nice move. Do not get used to leaning on it.",
      "That is what you bought it for, so use it.",
      "See, you can do it. When you feel like it, anyway.",
    ],
  },
  // --- Achats, onglet par onglet : chaque rayon du magasin a son propre commentaire ---
  achatProduction: {
    fr: [
      "Encore une bouche à nourrir. Enfin, une bouche qui travaille.",
      "Tu embauches. Attention, ils vont finir par demander des vacances.",
      "Un de plus sur le terrain. Bientôt il faudra un règlement intérieur.",
      "Celui-là a intérêt à en faire plus que toi. Ce n'est pas très difficile.",
      "Tu montes une équipe. Ta grand-mère appelait ça une famille.",
      "Encore un salaire. Enfin, si tu les payais.",
    ],
    en: [
      "Another mouth to feed. Well, a mouth that works.",
      "You are hiring. Careful, they will start asking for holidays.",
      "One more on the land. Soon you will need house rules.",
      "That one had better do more than you. Not a high bar.",
      "You are building a team. Your grandmother called that a family.",
      "Another wage. If you paid them, that is.",
    ],
  },
  achatClic: {
    fr: [
      "Tu t'améliores le doigt. On appelle ça un investissement, paraît-il.",
      "Un clic plus fort. Ton poignet te remerciera. Ou pas.",
      "Tu veux tout faire à la main. Je reconnais bien la famille.",
      "À force, tu vas creuser un trou dans ce terrain.",
      "Un doigt affûté. Voilà une carrière.",
      "Tu tapes plus fort. Ce n'est pas fin, mais ça marche.",
    ],
    en: [
      "Upgrading the finger. They call that an investment, apparently.",
      "Stronger clicks. Your wrist will thank you. Or not.",
      "You want to do it all by hand. That is my family alright.",
      "Keep that up and you will dig a hole in this land.",
      "A sharpened finger. What a career.",
      "You hit harder now. Not subtle, but it works.",
    ],
  },
  achatBatiments: {
    fr: [
      "Tu construis, maintenant. Ça devient sérieux, ce terrain.",
      "Du dur. Enfin quelque chose qui tiendra après toi.",
      "Une construction. J'espère que tu as vérifié les fondations.",
      "Voilà qui donne de l'allure. Presque autant que moi.",
      "Tu bâtis pour tes compagnons. Ils ne te remercieront pas.",
      "Ça, ça ne se déplace plus. Réfléchis avant de tout recommencer.",
    ],
    en: [
      "Building now, are we. This land is getting serious.",
      "Something solid. Finally, something that outlasts you.",
      "A building. I hope you checked the foundations.",
      "That gives the place some class. Almost as much as me.",
      "You are building for your companions. They will not thank you.",
      "That one is not moving again. Think before you start over.",
    ],
  },
  achatSpecial: {
    fr: [
      "Un objet rare. Ne le casse pas, je n'en ai pas d'autre.",
      "Celui-là, on ne l'achète qu'une fois. Comme un mariage.",
      "Tu collectionnes, maintenant. C'est comme ça que ça commence.",
      "Utile, ce truc. Sers-t'en, ne le laisse pas prendre la poussière.",
      "Voilà une dépense que j'approuve. Presque.",
      "Range-le bien. Le voisin a les doigts qui collent.",
    ],
    en: [
      "A rare item. Do not break it, I have no spares.",
      "That one you buy once. Like a wedding.",
      "You are a collector now. That is how it starts.",
      "Useful, that thing. Use it, do not let it gather dust.",
      "Now there is a purchase I approve of. Almost.",
      "Put it somewhere safe. The neighbour has sticky fingers.",
    ],
  },
  achatRecherche: {
    fr: [
      "Tu lis, maintenant ? Ta grand-mère aurait aimé voir ça.",
      "De la science sur mon terrain. On aura tout vu.",
      "Tu apprends. C'est plus lent que de creuser, mais ça paie mieux.",
      "Voilà où passent tes Connaissances. Au moins, ce n'est pas perdu.",
      "Continue comme ça et tu finiras par m'expliquer mon propre métier.",
      "Un livre coûte cher. Un livre non lu coûte encore plus cher.",
    ],
    en: [
      "Reading now, are we? Your grandmother would have loved to see this.",
      "Science on my land. Now I have seen everything.",
      "You are learning. Slower than digging, but it pays better.",
      "So that is where your Knowledge goes. At least it is not wasted.",
      "Keep this up and you will end up explaining my own trade to me.",
      "A book is expensive. An unread book is more expensive still.",
    ],
  },
  achatPrestige: {
    fr: [
      "Tu dépenses tes graines. J'espère que tu sais ce que tu fais.",
      "Ces graines-là valent plus que tout le terrain. Ne me demande pas pourquoi.",
      "Une amélioration qui survit à tout. Même à toi.",
      "Voilà, tu joues avec les grandes règles maintenant.",
      "Tu investis dans l'avenir. C'est nouveau, chez toi.",
      "Chaque graine dépensée, c'est une vie de terrain en moins. Ou en plus. Je ne sais plus.",
    ],
    en: [
      "Spending your seeds. I hope you know what you are doing.",
      "Those seeds are worth more than the whole plot. Do not ask me why.",
      "An upgrade that survives everything. Even you.",
      "There, you are playing by the big rules now.",
      "Investing in the future. That is new, for you.",
      "Every seed spent is one life of this land less. Or more. I forget.",
    ],
  },
  achatFamiliers: {
    fr: [
      "Tu t'occupes de ton animal. C'est mieux que de t'occuper de moi.",
      "Il travaille plus que toi, tu sais. Ne le vexe pas.",
      "Ta grand-mère aussi avait son favori. Il ne faisait rien non plus.",
      "Fais-le monter en niveau. Ça lui donnera un but dans la vie.",
      "Un compagnon bien traité, ça rapporte. Note-le quelque part.",
      "Il te suit partout. Au moins quelqu'un.",
    ],
    en: [
      "Taking care of your pet. Better than taking care of me.",
      "It works harder than you, you know. Do not upset it.",
      "Your grandmother had a favourite too. It did nothing either.",
      "Level it up. It will give the creature a purpose in life.",
      "A well-treated companion pays off. Write that down.",
      "It follows you everywhere. At least someone does.",
    ],
  },
  achatAscension: {
    fr: [
      "Des éclats d'étoile pour du jardinage. Le monde tourne à l'envers.",
      "Tu achètes avec de la lumière, maintenant. Je ne commente pas.",
      "Ça, c'est au-dessus de moi. Littéralement.",
      "Ces améliorations-là ne disparaîtront jamais. Comme mes reproches.",
      "Tu montes haut. Regarde quand même où tu mets les pieds.",
      "Je ne comprends pas la moitié de ce que tu achètes ici. Continue.",
    ],
    en: [
      "Stellar shards for gardening. The world is upside down.",
      "Buying things with starlight now. No comment.",
      "This one is above me. Literally.",
      "Those upgrades never go away. Like my complaints.",
      "You are climbing high. Watch where you put your feet all the same.",
      "I do not understand half of what you buy here. Carry on.",
    ],
  },
  achatAutomatisation: {
    fr: [
      "Tu délègues. Te voilà patron, dis donc.",
      "Une machine pour faire ton travail. J'aurais aimé y penser.",
      "Pendant qu'elle travaille, tu fais quoi, toi ?",
      "Attention, un jour elles n'auront plus besoin de toi.",
      "C'est ça, le progrès. Moi, j'avais une brouette.",
      "Tu automatises le jardinage. Ta grand-mère se retourne. De plaisir, sans doute.",
    ],
    en: [
      "Delegating, are we. Look at you, the boss.",
      "A machine to do your job. I wish I had thought of that.",
      "While it works, what exactly do you do?",
      "Careful, one day they will not need you at all.",
      "That is progress. I had a wheelbarrow.",
      "Automating the gardening. Your grandmother is turning in her grave. With joy, surely.",
    ],
  },
  mysteryTeaser: {
    fr: [
      "Continue comme ça, et peut-être que je te dirai pourquoi ce terrain compte tant pour moi.",
      "Tu n'as pas encore trouvé ce qu'il y a en dessous ? Tant mieux.",
      "Ce terrain a une histoire. Une longue histoire. Que tu ne connaîtras pas aujourd'hui.",
      "Ne creuse pas trop profond. Enfin, si, creuse. Mais… prudemment.",
      "Si jamais tu trouves quelque chose d'étrange là-dessous, appelle-moi. Avant de le toucher.",
      "J'ai mes raisons de garder un œil sur cet endroit. De bonnes raisons. Enfin, disons « raisons ».",
      "Ce terrain, je ne l'ai pas juste « gagné ». Mais c'est une histoire pour un autre jour.",
      "Tu sais ce qu'il y avait ici avant toi ? Non. Et c'est très bien comme ça.",
      "Certains voudraient bien mettre la main sur ce terrain. Pas juste toi.",
      "Un jour, tu comprendras pourquoi je passe si souvent. Ce jour n'est pas aujourd'hui.",
      "Il y a une pierre, au fond, que je n'ai jamais réussi à soulever. Laisse-la où elle est.",
      "Ta grand-mère savait, elle. Elle n'a jamais voulu en parler non plus.",
      "Ce terrain ne m'a pas coûté d'argent. Il m'a coûté autre chose.",
      "Tu entendras peut-être quelque chose, la nuit. Ne réponds pas.",
    ],
    en: [
      "Keep this up, and maybe I'll tell you why this land matters so much to me.",
      "Haven't found what's underneath yet? Good.",
      "This land has a history. A long one. One you won't hear today.",
      "Don't dig too deep. Actually, do dig. Just… carefully.",
      "If you ever find something strange down there, call me. Before touching it.",
      "I have my reasons for keeping an eye on this place. Good reasons. Well, let's call them \"reasons\".",
      "I didn't just \"win\" this land. But that's a story for another day.",
      "Know what was here before you? No. And that's for the best.",
      "Some people would love to get their hands on this land. Not just you.",
      "One day, you'll understand why I visit so often. Today is not that day.",
      "There is a stone at the back I never managed to lift. Leave it where it is.",
      "Your grandmother knew. She never wanted to talk about it either.",
      "This land did not cost me money. It cost me something else.",
      "You might hear something at night. Do not answer it.",
    ],
  },
};

const _papiLineHistory = {};
// Tire une phrase au hasard dans le pool de la catégorie, en évitant de répéter une des
// dernières répliques tirées (pas juste la toute dernière) pour une meilleure variété.
function pickPapiLine(category) {
  const pool = PAPI_LINES[category];
  if (!pool) return null;
  const lines = pool[state.lang] || pool.fr;
  if (!lines || lines.length === 0) return null;
  if (lines.length === 1) return lines[0];
  const historyKey = category + '_' + state.lang;
  const history = _papiLineHistory[historyKey] || [];
  const maxHistory = Math.min(lines.length - 1, 5);
  let idx, attempts = 0;
  do { idx = Math.floor(Math.random() * lines.length); attempts++; }
  while (history.includes(idx) && attempts < 50);
  _papiLineHistory[historyKey] = [...history, idx].slice(-maxHistory);
  return lines[idx];
}
// Affiche une réplique de Papi tirée d'une catégorie donnée, uniquement quand le joueur est
// sur l'écran principal (aucune fenêtre/modale ouverte) — sinon la réplique est simplement
// ignorée pour cette fois plutôt que d'interrompre un menu.
function papiSaysFromCategory(category, options = {}) {
  // Une remarque spontanée n'a pas à couvrir une présentation en cours : `isMainScreenBlocked`
  // ne voit pas une bulle de tutoriel affichée sans fenêtre ouverte, `tutorialInProgress` si.
  if (isMainScreenBlocked() || tutorialInProgress()) return false;
  const line = pickPapiLine(category);
  if (!line) return false;
  // Remarque spontanée : elle s'efface toute seule, le joueur n'a pas à cliquer dessus.
  showDialogue('papi', [line], { position: options.position || 'top-right', autoAdvanceMs: papiReadingPauseMs(line), onComplete: options.onComplete });
  return true;
}

// ================= ANNONCES DES ONGLETS =================
// Ce que Papi dit en présentant chaque onglet (sauf Production, disponible dès le début).
const PAPI_TAB_ANNOUNCEMENTS_BI = {
  // Une explication = plusieurs bulles courtes : une réplique trop longue agrandirait la bulle.
  // Mieux vaut une bulle de plus qu'une bulle plus grande (vérifié par tests/mesure-bulles.js).
  // Un onglet ne parle que de ce que le joueur connaît déjà au moment où il apparaît.
  production: {
    fr: [
      "Voici le cœur du jardin : les compagnons. Chacun te rapporte de la Verdure tout seul, chaque seconde, même quand tu ne cliques pas.",
      "Chaque exemplaire acheté coûte 20 % de plus que le précédent. C'est normal, il faut bien que je paie mon loyer.",
      "À 10, 20, 30, 40, 50 exemplaires d'un même compagnon, et ainsi de suite, tu passes un palier : sa production est multipliée par 1.25.",
      "La petite barre sous son nom te montre où tu en es avant le prochain palier.",
      "Les « ??? » sont des compagnons que tu n'as pas encore découverts. Ils se dévoilent dans l'ordre : achète celui d'avant pour voir le suivant.",
      "Les boutons au-dessus de la liste choisissent combien d'exemplaires tu achètes d'un coup. MAX achète tout ce que tu peux payer.",
      "Et l'étiquette « Meilleur rapport qualité/prix » indique le compagnon qui rapporte le plus pour son prix. Si tu hésites, suis-la.",
    ],
    en: [
      "Here's the heart of the garden: companions. Each one brings you Greenery on its own, every second, even when you're not clicking.",
      "Each copy you buy costs 20% more than the previous one. That's normal, I've got rent to pay.",
      "At 10, 20, 30, 40, 50 copies of the same companion, and so on, you reach a milestone: its production is multiplied by 1.25.",
      "The little bar under its name shows how close you are to the next milestone.",
      "The \"???\" are companions you haven't discovered yet. They're revealed in order: buy the previous one to see the next.",
      "The buttons above the list choose how many copies you buy at once. MAX buys as many as you can afford.",
      "And the \"Best value for money\" tag points to the companion that earns the most for its price. If you're unsure, follow it.",
    ],
  },
  clic: {
    fr: [
      "Tiens, j'avais des gants renforcés qui traînaient au fond du magasin, cachés derrière un stock dont je préfère ne pas parler.",
      "Ici, tu améliores ton clic. Chaque amélioration ne s'achète qu'une seule fois, avec de la Verdure.",
      "Certaines ajoutent de la Verdure à chaque clic, d'autres te donnent un pourcentage de ta production par clic, et d'autres multiplient le tout.",
      "Plus ta production augmente, plus les pourcentages rapportent. C'est utile tant que tu cliques à la main.",
    ],
    en: [
      "Here, I had some reinforced gloves lying around at the back of the shop, hidden behind stock I'd rather not talk about.",
      "This is where you upgrade your click. Each upgrade can only be bought once, with Greenery.",
      "Some add Greenery to every click, some give you a percentage of your production per click, and others multiply everything.",
      "The more your production grows, the more those percentages are worth. It's useful as long as you click by hand.",
    ],
  },
  batiments: {
    fr: [
      "Ça, c'est du solide : chaque bâtiment ne s'achète qu'une seule fois, et il améliore un seul compagnon, celui indiqué dans sa description.",
      "Par exemple, un bâtiment « x2 » pour tes têtards double la production de tous tes têtards. Les autres compagnons, eux, ne changent pas.",
      "Commence donc par les compagnons que tu as en grand nombre. Un bâtiment pour un compagnon que tu n'as pas ne rapporte rien du tout.",
    ],
    en: [
      "Now this is solid stuff: each building can only be bought once, and it improves a single companion, the one named in its description.",
      "For example, an \"x2\" building for your tadpoles doubles the production of all your tadpoles. The other companions don't change.",
      "So start with the companions you own a lot of. A building for a companion you don't have earns nothing at all.",
    ],
  },
  special: {
    fr: [
      "J'ai reçu du matériel… disons, particulier : des objets uniques, en un seul exemplaire chacun.",
      "La plupart sont des capacités : tu les déclenches toi-même pour un gros coup de pouce, puis elles se rechargent pendant un moment.",
      "Une fois achetée, une capacité apparaît sous forme de rond à gauche de l'écran. Clique dessus quand elle brille ; le cadran sombre montre la recharge.",
      "Quelques objets fonctionnent tout seuls, sans que tu aies quoi que ce soit à faire, comme le chat qui te rapporte un petit cadeau toutes les heures.",
      "Lis bien les descriptions avant d'acheter : certains objets sont plus malins qu'ils n'en ont l'air.",
    ],
    en: [
      "I've received some… let's say, unusual gear: one-of-a-kind items, a single copy of each.",
      "Most of them are abilities: you trigger them yourself for a big boost, then they recharge for a while.",
      "Once bought, an ability shows up as a circle on the left of the screen. Click it when it glows; the dark dial shows the recharge.",
      "A few items work on their own, without you having to do anything, like the cat that brings you a little gift every hour.",
      "Read the descriptions carefully before buying: some items are cleverer than they look.",
    ],
  },
  recherche: {
    fr: [
      "Un ami m'a offert des livres de recherche. Enfin, « offert »… disons qu'il me devait de l'argent.",
      "La Recherche se paie en Connaissances 📚. Tu en gagnes 1 par minute de jeu, quoi que tu fasses : ta production n'y change rien.",
      "Chaque recherche donne un bonus permanent : plus de production, des compagnons moins chers ou plus de Connaissances.",
      "D'autres réduisent les effets du mauvais temps, ou te font gagner davantage pendant que le jeu est fermé.",
      "Certaines demandent d'avoir terminé la précédente. En bas, les recherches infinies s'achètent encore et encore, un peu plus cher à chaque fois.",
      "Une recherche achetée est acquise pour de bon : tu la garderas quoi qu'il arrive.",
    ],
    en: [
      "A friend gave me some research books. Well, \"gave\"… let's say he owed me money.",
      "Research is paid with Knowledge 📚. You earn 1 per minute of play, whatever you do: your production doesn't change that.",
      "Each research gives a permanent bonus: more production, cheaper companions or more Knowledge.",
      "Others reduce the effects of bad weather, or make you earn more while the game is closed.",
      "Some require the previous one first. At the bottom, infinite research can be bought again and again, a little pricier each time.",
      "Research you buy is yours for good: you'll keep it no matter what.",
    ],
  },
  prestige: {
    fr: [
      "Tu as bien avancé. Il faut qu'on parle du Prestige, qu'on appelle aussi « Terraformer ». Écoute bien, c'est important.",
      "Terraformer, c'est tout recommencer : ta Verdure, tes compagnons, ton Clic, tes Bâtiments et ton Spécial repartent à zéro.",
      "Ce que tu gardes : ta Recherche, tes Connaissances, tes succès et tout ce que tu achètes avec des Graines.",
      "En échange, tu gagnes des Graines Cosmiques 🌌. Leur nombre dépend de la Verdure que tu as en poche au moment de terraformer.",
      "Il faut 40 milliards de Verdure en poche pour 1 Graine. Pour 2 Graines, il en faut 8 fois plus, et pour 3, 27 fois plus.",
      "Tes Graines servent à deux choses. D'abord, chaque Graine gagnée augmente ta production pour toujours : +10 % pour 1, +20 % pour 4, +30 % pour 9.",
      "Dépenser tes Graines ne fait pas baisser ce bonus, car il compte les Graines que tu as gagnées, pas celles qui te restent.",
      "Ensuite, tu les dépenses ici, dans des améliorations que tu gardes d'un Prestige à l'autre.",
      "Tu recommences donc, mais en plus fort : tout se rachète beaucoup plus vite. La barre au-dessus du bouton montre ce qu'il te manque pour la Graine suivante.",
    ],
    en: [
      "You've come a long way. We need to talk about Prestige, also called \"Terraforming\". Listen carefully, this matters.",
      "Terraforming means starting over: your Greenery, companions, Click, Buildings and Special all go back to zero.",
      "What you keep: your Research, your Knowledge, your achievements and everything you buy with Seeds.",
      "In exchange, you earn Cosmic Seeds 🌌. How many depends on the Greenery you have on hand when you terraform.",
      "You need 40 billion Greenery on hand for 1 Seed. For 2 Seeds you need 8 times more, and for 3, 27 times more.",
      "Your Seeds do two things. First, every Seed earned raises your production forever: +10% for 1, +20% for 4, +30% for 9.",
      "Spending your Seeds doesn't lower that bonus, because it counts the Seeds you've earned, not the ones you have left.",
      "Second, you spend them here, on upgrades you keep from one Prestige to the next.",
      "So you start over, but stronger: everything gets bought back much faster. The bar above the button shows what you need for the next Seed.",
    ],
  },
  ascension: {
    fr: [
      "Là, on passe dans la cour des grands : l'Ascension. C'est un cran au-dessus du Prestige, alors écoute bien.",
      "Une Ascension fonctionne d'abord comme un Prestige : Verdure, compagnons, Clic, Bâtiments et Spécial repartent à zéro.",
      "Mais en plus, tu perds tes Graines Cosmiques, le bonus de production qu'elles te donnaient et les améliorations de l'onglet Prestige.",
      "Ce que tu gardes : ta Recherche, tes Connaissances, tes succès, tes familiers et leurs niveaux, les défis réussis et ce qui s'achète avec des Éclats.",
      "En échange, tu gagnes des Éclats Stellaires ✨ selon les Graines gagnées depuis ta dernière Ascension : 15 pour ton premier Éclat, puis de plus en plus.",
      "Chaque Éclat gagné augmente ta production de 50 % pour toujours (un peu moins au-delà de 20 Éclats), et te fait gagner plus de Graines à chaque Prestige.",
      "Après chaque Ascension, tes Prestiges rapportent donc plus de Graines. Ils restent toujours utiles, puisque ce sont eux qui te font gagner des Éclats.",
      "Tu dépenses tes Éclats ici, dans des améliorations permanentes. Chaque Ascension débloque aussi des nouveautés : familiers, automatisations et défis.",
      "Le bon moment pour une Ascension ? Quand tes Graines ne te font plus assez avancer. Tu perds leur bonus, mais tes Éclats te feront repartir bien plus vite.",
    ],
    en: [
      "Now we're in the big leagues: Ascension. It's a step above Prestige, so listen carefully.",
      "An Ascension first works like a Prestige: Greenery, companions, Click, Buildings and Special go back to zero.",
      "But on top of that, you lose your Cosmic Seeds, the production bonus they gave you and the upgrades from the Prestige tab.",
      "What you keep: your Research, Knowledge, achievements, pets and their levels, completed challenges and what you buy with Shards.",
      "In exchange, you earn Stellar Shards ✨ based on the Seeds earned since your last Ascension: 15 for your first Shard, then more and more.",
      "Every Shard earned raises your production by 50% forever (a bit less past 20 Shards), and makes you earn more Seeds on every Prestige.",
      "So after each Ascension, your Prestiges bring in more Seeds. They always stay useful, since they're what earns you Shards.",
      "You spend your Shards here, on permanent upgrades. Each Ascension also unlocks new things: pets, automations and challenges.",
      "The right time for an Ascension? When your Seeds no longer move you forward enough. You lose their bonus, but your Shards will get you going much faster.",
    ],
  },
  automatisation: {
    fr: [
      "Bon. J'en ai assez de te voir cliquer sur les mêmes bestioles, ça me fatigue rien qu'à te regarder.",
      "Ici, le jardin se débrouille tout seul. Chaque automatisation s'allume ou s'éteint avec son bouton, quand tu veux.",
      "L'achat automatique achète tout seul le compagnon au meilleur rapport qualité/prix. Il n'achète que des compagnons.",
      "L'activation automatique lance tes capacités dès qu'elles sont rechargées, sans remplacer un bonus plus fort déjà en cours.",
      "Le Prestige automatique terraforme dès que tu peux gagner le nombre de Graines choisi avec les boutons − et +. Il est éteint au départ.",
      "Les automatisations se débloquent une par une, au fil de ta progression.",
    ],
    en: [
      "Right. I'm tired of watching you click the same critters, it wears me out just looking at you.",
      "In here, the garden takes care of itself. Each automation switches on or off with its button, whenever you like.",
      "Automatic buying buys the best-value companion on its own. It only buys companions.",
      "Automatic abilities trigger your abilities as soon as they recharge, without replacing a stronger bonus already running.",
      "Automatic Prestige terraforms as soon as you can earn the number of Seeds picked with the − and + buttons. It starts switched off.",
      "Automations unlock one by one as you progress.",
    ],
  },
  familiers: {
    fr: [
      "Tu as remarqué la bestiole qui traîne dans ton jardin ? C'est ton familier. D'autres viendront au fil de ta progression.",
      "Un seul familier te suit à la fois. Clique sur « Choisir » pour en changer quand tu veux : c'est gratuit et l'effet est immédiat.",
      "Chacun t'aide à sa façon : production, clics, Connaissances, capacités ou prix des compagnons.",
      "Tu les fais monter de niveau avec des Graines Cosmiques, jusqu'au niveau 10. Chaque niveau augmente leur bonus.",
      "Seul le familier choisi donne son bonus, mais les niveaux gagnés restent acquis pour toujours.",
    ],
    en: [
      "Noticed the critter hanging around your garden? That's your pet. Others will come as you progress.",
      "Only one pet follows you at a time. Click \"Choose\" to switch whenever you like: it's free and takes effect right away.",
      "Each one helps in its own way: production, clicks, Knowledge, abilities or companion prices.",
      "You level them up with Cosmic Seeds, up to level 10. Each level raises their bonus.",
      "Only the chosen pet gives its bonus, but the levels you earn are kept forever.",
    ],
  },
  galerie: {
    fr: [
      "Et voici ma petite fierté : tous les compagnons et les bâtiments que tu as rencontrés, bien rangés.",
      "Ceux que tu n'as pas encore trouvés apparaissent en silhouette. Et non, je ne te dirai pas ce que c'est : il faut bien garder un peu de mystère.",
    ],
    en: [
      "And here's my little pride: every companion and building you've come across, neatly filed.",
      "The ones you haven't found yet appear as silhouettes. And no, I won't tell you what they are: we have to keep some mystery.",
    ],
  },
  dailyreward: {
    fr: [
      "Et pense à repasser tous les jours : je te laisse un petit quelque chose devant la porte.",
      "Le calendrier tourne sur 7 jours, avec une récompense chaque jour, et le septième jour est le plus généreux.",
      "Si tu manques un jour, la série repart au premier jour. Alors passe au moins une fois par jour, même rapidement.",
    ],
    en: [
      "And remember to come by every day: I leave a little something at your door.",
      "The calendar runs over 7 days, with a reward each day, and the seventh day is the most generous.",
      "If you miss a day, the streak goes back to day one. So drop by at least once a day, even briefly.",
    ],
  },
  quetes: {
    fr: [
      "J'ai quelques petites missions pour toi, histoire de pimenter un peu les choses.",
      "Chaque jour, tu reçois 3 quêtes : cliquer, produire de la Verdure, acheter des compagnons ou attraper des herbes dorées.",
      "Quand une barre est pleine, réclame ta récompense.",
      "Les quêtes changent chaque jour. Rien n'est obligatoire, mais c'est toujours bon à prendre.",
    ],
    en: [
      "I've got a few small missions for you, just to spice things up.",
      "Every day you get 3 quests: clicking, producing Greenery, buying companions or catching golden weeds.",
      "When a bar is full, claim your reward.",
      "Quests change every day. Nothing is mandatory, but it's always worth taking.",
    ],
  },
  defi: {
    fr: [
      "Si tu te sens motivé, j'ai des défis pour les courageux : des règles tordues, comme l'interdiction de cliquer ou des prix dix fois plus élevés.",
      "Lancer un défi fait tout repartir de zéro, comme un Prestige, mais tu gardes tes Graines. Ensuite, tu dois respecter une règle.",
      "Pour le réussir, fais un Prestige qui rapporte au moins le nombre de Graines demandé, en respectant la règle jusqu'au bout.",
      "Au Prestige, le défi s'arrête, qu'il soit réussi ou non. Tu peux aussi abandonner quand tu veux. Un seul défi à la fois.",
      "Un défi réussi te donne une récompense permanente, indiquée sous le défi. Les suivants se débloquent au fil de ta progression.",
    ],
    en: [
      "If you're feeling motivated, I've got challenges for the brave: twisted rules, like no clicking allowed or prices ten times higher.",
      "Starting a challenge resets everything, like a Prestige, but you keep your Seeds. Then you have to follow a rule.",
      "To complete it, do a Prestige worth at least the number of Seeds required, following the rule all the way.",
      "On Prestige, the challenge ends, whether it's completed or not. You can also give up anytime. One challenge at a time.",
      "A completed challenge gives you a permanent reward, shown under the challenge. The next ones unlock as you progress.",
    ],
  },
  succes: {
    fr: [
      "Tiens, voici le registre de tes exploits. Pratique pour te vanter.",
      "Chaque succès débloqué augmente ta production de Verdure pour toujours. Le bonus total est affiché en haut.",
    ],
    en: [
      "Here's the record of your achievements. Handy for bragging.",
      "Every achievement unlocked raises your Greenery production forever. The total bonus is shown at the top.",
    ],
  },
};
