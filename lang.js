// lang.js - Übersetzungen für das Panorama-Projekt
const text = {
    de: {
        sprache: "Sprache:", ausschnitt: "🌍 Ausschnitt:", schweiz: "Schweiz", europa: "Europa", welt: "Welt",
        kontur: "Panorama Kontur", vergroessern: "Bild vergrößern", play: "🎵 Abspielen",
        grp_struktur: "🏔️ Struktur & Auswahl", grp_klang: "🎹 Klang & Raum",
        gipfel: "Gipfel:", taeler: "Täler:", abstand: "Abstand (Pixel):", sensibilitaet: "Sensibilität:",
        modus: "Modus:", mod_gleich: "Akkord (Zusammen)", mod_lr: "Sequenz (Links -> Rechts)", mod_rl: "Sequenz (Rechts -> Links)",
        tonart: "Tonart:", oktaven: "Oktaven (Umfang):", range: "Höhen-Skalierung (%):", wellenform: "Klangfarbe (Patch):",
        lautstaerke: "Volume:", dauer: "Basis-Dauer (s):", attack: "Attack (Einblenden):", release: "Release (Ausblenden):", echo: "Atmosphäre (Echo):",
        scale_major: "Dur (Majestätisch)", scale_minor: "Moll (Melancholisch)", scale_lydian: "Lydisch (Träumend)", scale_dorian: "Dorisch (Mystisch)", scale_pentatonic: "Pentatonik (Harmonisch)", scale_hirajoshi: "Hirajōshi (Meditativ)",
        wave_sine: "Sinus (Rein)", wave_triangle: "Dreieck (Weich)", wave_sawtooth: "Sägezahn (Scharf)", wave_square: "Rechteck (Retro/8-Bit)", wave_organ: "Kirchenorgel (Mächtig)", wave_darkpad: "Dark Pad (Kino/Warm)", wave_chime: "Glöckchen (Magisch)",
        // NEU: Tooltips für Icon-Buttons
        hint_play_current: "Aktuelle Einstellungen abspielen",
        hint_play_sel: "Selektion abspielen (Markierte Presets)",
        hint_load_sel: "Selektierte Einstellungen laden",
        hint_save: "Aktuelle Einstellungen speichern"
    },
    fr: {
        sprache: "Langue :", ausschnitt: "🌍 Vue :", schweiz: "Suisse", europa: "Europe", welt: "Monde",
        kontur: "Contour du Panorama", vergroessern: "Agrandir l'image", play: "🎵 Jouer",
        grp_struktur: "🏔️ Structure & Sélection", grp_klang: "🎹 Son & Espace",
        gipfel: "Sommets :", taeler: "Vallées :", abstand: "Espacement (px) :", sensibilitaet: "Sensibilité :",
        modus: "Mode :", mod_gleich: "Accord (Ensemble)", mod_lr: "Séquence (G -> D)", mod_rl: "Séquence (D -> G)",
        tonart: "Gamme :", oktaven: "Octaves (Ambitus) :", range: "Échelle de hauteur (%) :", wellenform: "Timbre (Patch) :",
        lautstaerke: "Volume :", dauer: "Durée de base (s) :", attack: "Attack (Apparition) :", release: "Release (Disparition) :", echo: "Atmosphère (Écho) :",
        scale_major: "Majeur (Majestueux)", scale_minor: "Mineur (Mélancolique)", scale_lydian: "Lydien (Rêveur)", scale_dorian: "Dorien (Mystique)", scale_pentatonic: "Pentatonique (Harmonique)", scale_hirajoshi: "Hirajōshi (Méditatif)",
        wave_sine: "Sinusoïde (Pur)", wave_triangle: "Triangle (Doux)", wave_sawtooth: "Dent de scie (Tranchant)", wave_square: "Carré (Rétro)", wave_organ: "Orgue (Puissant)", wave_darkpad: "Dark Pad (Cinéma/Chaud)", wave_chime: "Carillon (Magique)",
        hint_play_current: "Jouer les paramètres actuels", hint_play_sel: "Jouer la sélection", hint_load_sel: "Charger la sélection", hint_save: "Sauvegarder les paramètres"
    },
    it: {
        sprache: "Lingua:", ausschnitt: "🌍 Vista:", schweiz: "Svizzera", europa: "Europa", welt: "Mondo",
        kontur: "Contorno Panoramico", vergroessern: "Ingrandisci", play: "🎵 Riproduci",
        grp_struktur: "🏔️ Struttura & Selezione", grp_klang: "🎹 Suono & Spazio",
        gipfel: "Cime:", taeler: "Valli:", abstand: "Distanza (px):", sensibilitaet: "Sensibilità:",
        modus: "Modalità:", mod_gleich: "Accordo (Insieme)", mod_lr: "Sequenza (S -> D)", mod_rl: "Sequenza (D -> S)",
        tonart: "Scala:", oktaven: "Ottave (Estensione):", range: "Scala di altezza (%):", wellenform: "Timbro (Patch):",
        lautstaerke: "Volume:", dauer: "Durata base (s):", attack: "Attack (Ingresso):", release: "Release (Uscita):", echo: "Atmosfera (Eco):",
        scale_major: "Maggiore (Maestoso)", scale_minor: "Minore (Malinconico)", scale_lydian: "Lidio (Sognante)", scale_dorian: "Dorico (Mistico)", scale_pentatonic: "Pentatonico (Armonico)", scale_hirajoshi: "Hirajōshi (Meditativo)",
        wave_sine: "Sinusoidale (Puro)", wave_triangle: "Triangolare (Dolce)", wave_sawtooth: "Dente di sega (Tagliente)", wave_square: "Quadrata (Retro)", wave_organ: "Organo (Imponente)", wave_darkpad: "Dark Pad (Cinema/Caldo)", wave_chime: "Campanella (Magico)",
        hint_play_current: "Riproduci impostazioni attuali", hint_play_sel: "Riproduci selezione", hint_load_sel: "Carica selezione", hint_save: "Salva impostazioni"
    },
    en: {
        sprache: "Language:", ausschnitt: "🌍 View:", schweiz: "Switzerland", europa: "Europe", welt: "World",
        kontur: "Panorama Contour", vergroessern: "Enlarge image", play: "🎵 Play",
        grp_struktur: "🏔️ Structure & Selection", grp_klang: "🎹 Sound & Space",
        gipfel: "Peaks:", taeler: "Valleys:", abstand: "Spacing (px):", sensibilitaet: "Sensitivity:",
        modus: "Mode:", mod_gleich: "Chord (Together)", mod_lr: "Sequence (L -> R)", mod_rl: "Sequence (R -> L)",
        tonart: "Scale:", oktaven: "Octaves (Range):", range: "Height Scaling (%):", wellenform: "Timbre (Patch):",
        lautstaerke: "Volume:", dauer: "Base Duration (s):", attack: "Attack (Fade In):", release: "Release (Fade Out):", echo: "Atmosphere (Echo):",
        scale_major: "Major (Majestic)", scale_minor: "Minor (Melancholic)", scale_lydian: "Lydian (Dreamy)", scale_dorian: "Dorian (Mystic)", scale_pentatonic: "Pentatonic (Harmonic)", scale_hirajoshi: "Hirajōshi (Meditative)",
        wave_sine: "Sine (Pure)", wave_triangle: "Triangle (Soft)", wave_sawtooth: "Sawtooth (Sharp)", wave_square: "Square (Retro)", wave_organ: "Church Organ (Massive)", wave_darkpad: "Dark Pad (Cinematic)", wave_chime: "Chime (Magic)",
        hint_play_current: "Play current settings", hint_play_sel: "Play selection", hint_load_sel: "Load selected preset", hint_save: "Save current settings"
    },
    uk: {
        sprache: "Мова:", ausschnitt: "🌍 Вигляд:", schweiz: "Швейцарія", europa: "Європа", welt: "Світ",
        kontur: "Контур панорами", vergroessern: "Збільшити зображення", play: "🎵 Грати",
        grp_struktur: "🏔️ Структура та вибір", grp_klang: "🎹 Звук та простір",
        gipfel: "Вершини:", taeler: "Долини:", abstand: "Відстань (px):", sensibilitaet: "Чутливість:",
        modus: "Режим:", mod_gleich: "Акорд (Разом)", mod_lr: "Послідовність (Л -> П)", mod_rl: "Послідовність (П -> Л)",
        tonart: "Лад / Гама:", oktaven: "Октави (Діапазон):", range: "Масштаб висоти (%):", wellenform: "Тембр (Патч):",
        lautstaerke: "Гучність:", dauer: "Тривалість (с):", attack: "Атака (Наростання):", release: "Спад (Загасання):", echo: "Атмосфера (Ехо):",
        scale_major: "Мажор (Величний)", scale_minor: "Мінор (Меланхолійний)", scale_lydian: "Лідійський (Мрійливий)", scale_dorian: "Дорійський (Містичний)", scale_pentatonic: "Пентатоніка (Гармонійний)", scale_hirajoshi: "Хірайоші (Медитативний)",
        wave_sine: "Синус (Чистий)", wave_triangle: "Трикутник (М'який)", wave_sawtooth: "Пилка (Різкий)", wave_square: "Квадрат (Ретро)", wave_organ: "Орган (Масивний)", wave_darkpad: "Dark Pad (Кіно/Теплий)", wave_chime: "Дзвіночок (Магічний)",
        hint_play_current: "Відтворити поточні налаштування", hint_play_sel: "Відтворити вибране", hint_load_sel: "Завантажити вибране", hint_save: "Зберегти налаштування"
    },
    ru: {
        sprache: "Язык:", ausschnitt: "🌍 Вид:", schweiz: "Швейцария", europa: "Европа", welt: "Мир",
        kontur: "Контур панорамы", vergroessern: "Увеличить", play: "🎵 Играть",
        grp_struktur: "🏔️ Структура и выбор", grp_klang: "🎹 Звук и пространство",
        gipfel: "Пики:", taeler: "Долины:", abstand: "Интервал (px):", sensibilitaet: "Чувствительность:",
        modus: "Режим:", mod_gleich: "Аккорд (Вместе)", mod_lr: "Секвенция (Л -> П)", mod_rl: "Секвенция (П -> Л)",
        tonart: "Лад / Гамма:", oktaven: "Октавы (Диапазон):", range: "Масштаб высоты (%):", wellenform: "Тембр (Патч):",
        lautstaerke: "Громкость:", dauer: "Длительность (с):", attack: "Атака (Нарастание):", release: "Спад (Затухание):", echo: "Атмосфера (Эхо):",
        scale_major: "Мажор (Величественный)", scale_minor: "Минор (Меланхоличный)", scale_lydian: "Лидийский (Мечтательный)", scale_dorian: "Дорийский (Мистический)", scale_pentatonic: "Пентатоника (Гармоничный)", scale_hirajoshi: "Хираёси (Медитативный)",
        wave_sine: "Синус (Чистый)", wave_triangle: "Треугольник (Мягкий)", wave_sawtooth: "Пила (Резкий)", wave_square: "Квадрат (Ретро)", wave_organ: "Орган (Массивный)", wave_darkpad: "Dark Pad (Кино/Теплый)", wave_chime: "Колокольчик (Магический)",
        hint_play_current: "Воспроизвести текущие настройки", hint_play_sel: "Воспроизвести выбранное", hint_load_sel: "Загрузить выбранное", hint_save: "Сохранить настройки"
    }
};
