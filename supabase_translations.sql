-- ==============================================================
-- Supabase Migration: Create translations table and populate keys
-- ==============================================================

CREATE TABLE IF NOT EXISTS translations (
    key_name TEXT PRIMARY KEY,
    de TEXT,
    fr TEXT,
    it TEXT,
    en TEXT,
    uk TEXT,
    ru TEXT,
    es TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Allow anonymous/public read access
DROP POLICY IF EXISTS "Allow public read access on translations" ON translations;
CREATE POLICY "Allow public read access on translations"
    ON translations
    FOR SELECT
    USING (true);

-- Insert translations (with ON CONFLICT to make execution idempotent)
INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('oktave_1', '1 Oktave', '1 Octave', '1 Ottava', '1 Octave', '1 Октава', '1 Октава', '1 Octava')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('oktave_2', '2 Oktaven', '2 Octaves', '2 Ottave', '2 Octaves', '2 Октави', '2 Октавы', '2 Octavas')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('oktave_3', '3 Oktaven', '3 Octaves', '3 Ottave', '3 Octaves', '3 Октави', '3 Октавы', '3 Octavas')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('oktave_4', '4 Oktaven', '4 Octaves', '4 Ottave', '4 Octaves', '4 Октави', '4 Октавы', '4 Octavas')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('oktave_5', '5 Oktaven', '5 Octaves', '5 Ottave', '5 Octaves', '5 Октав', '5 Октав', '5 Octavas')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('oktave_6', '6 Oktaven', '6 Octaves', '6 Ottave', '6 Octaves', '6 Октав', '6 Октав', '6 Octavas')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_data_not_found', 'Daten nicht gefunden.', 'Données non trouvées.', 'Dati non trovati.', 'Data not found.', 'Дані не знайдено.', 'Данные не найдены.', 'Datos no encontrados.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_no_points_adj', 'Keine Punkte gefunden. Bitte Einstellungen anpassen.', 'Aucun point trouvé. Veuillez ajuster les paramètres.', 'Nessun punto trovato. Modifica le impostazioni.', 'No points found. Please adjust settings.', 'Точок не знайдено. Будь ласка, змініть налаштування.', 'Точки не найдены. Пожалуйста, измените настройки.', 'No se encontraron puntos. Por favor, ajusta la configuración.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_ai_error', 'Fehler bei der AI Generierung.', 'Erreur lors de la génération IA.', 'Errore durante la generazione IA.', 'Error during AI generation.', 'Помилка під час генерації ШІ.', 'Ошибка при генерации ИИ.', 'Error en la generación por IA.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_gen_vinyl_array_first', 'Bitte generiere zuerst das Vinyl-Array!', 'Veuillez générer le tableau vinyle d''abord !', 'Si prega di generare prima l''array in vinile!', 'Please generate the vinyl array first!', 'Будь ласка, спершу згенеруйте вініловий масив!', 'Пожалуйста, сначала сгенерируйте виниловый массив!', '¡Por favor, genera primero la matriz de vinilo!')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_gen_vinyl_array_data', 'Bitte generiere zuerst ein Vinyl-Array mit ausreichend Daten (mind. 16 Punkte)!', 'Veuillez générer d''abord un tableau vinyle avec suffisamment de données (au moins 16 points) !', 'Genera prima un array in vinile con dati sufficienti (min. 16 punti)!', 'Please first generate a vinyl array with sufficient data (min. 16 points)!', 'Будь ласка, спершу згенеруйте вініловий масив з достатньою кількістю даних (мін. 16 точок)!', 'Пожалуйста, сначала сгенерируйте виниловый массив с достаточным количеством данных (не менее 16 точек)!', '¡Por favor, genera primero una matriz de vinilo con suficientes datos (mín. 16 puntos)!')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_gen_ai_seq_first', 'Bitte generiere zuerst eine AI Sequenz!', 'Veuillez d''abord générer une séquence IA !', 'Genera prima una sequenza IA!', 'Please generate an AI sequence first!', 'Будь ласка, спершу згенеруйте послідовність ШІ!', 'Пожалуйста, сначала сгенерируйте ИИ-последовательность!', '¡Por favor, genera primero una secuencia de IA!')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_audio_error', 'Audio-Fehler: ', 'Erreur audio: ', 'Errore audio: ', 'Audio Error: ', 'Помилка аудіо: ', 'Ошибка аудио: ', 'Error de audio: ')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_gen_ai_comp_first', 'Bitte generiere zuerst eine AI Komposition.', 'Veuillez générer d''abord une composition IA.', 'Si prega di generare prima una composizione IA.', 'Please generate an AI composition first.', 'Будь ласка, спочатку згенеруйте ШІ композицію.', 'Пожалуйста, сначала сгенерируйте ИИ композицию.', 'Por favor, genera primero una composición de IA.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_delete_error', 'Fehler beim Löschen.', 'Erreur lors de la suppression.', 'Errore durante l''eliminazione.', 'Error during deletion.', 'Помилка під час видалення.', 'Ошибка при удалении.', 'Error al eliminar.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_load_vinyl_preset_empty', 'Bitte markiere ein Vinyl Preset zum Laden.', 'Veuillez sélectionner un préréglage vinyle à charger.', 'Seleziona un preset in vinile da caricare.', 'Please check a vinyl preset to load.', 'Будь ласка, виберіть вініловий пресет для завантаження.', 'Пожалуйста, выберите виниловый пресет для загрузки.', 'Por favor, selecciona un preset de vinilo para cargar.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_vinyl_loaded', 'Vinyl geladen!', 'Vinyle chargé !', 'Vinile caricato!', 'Vinyl loaded!', 'Вініл завантажено!', 'Винил загружен!', '¡Vinilo cargado!')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_vinyl_parse_error', 'Fehler beim Parsen der Vinyl-Daten.', 'Erreur lors de l''analyse des données vinyle.', 'Errore durante l''analisi dei dati del vinile.', 'Error parsing vinyl data.', 'Помилка при розборі даних вінілу.', 'Ошибка при разборе данных винила.', 'Error al analizar los datos del vinilo.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('btn_relief_scan', 'Relief scannen', 'Scanner le relief', 'Scansione rilievo', 'Scan Relief', 'Сканувати рельєф', 'Сканировать рельеф', 'Escanear relieve')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('guidance_start', 'Startpunkt platzieren', 'Placer le point de départ', 'Posiziona punto di partenza', 'Place start point', 'Встановіть початкову точку', 'Укажите начальную точку', 'Colocar punto de inicio')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('guidance_end', 'Zielpunkt setzen', 'Définir le point d''arrivée', 'Imposta punto di arrivo', 'Set destination point', 'Встановіть точку призначення', 'Укажите точку назначения', 'Definir punto de destino')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('btn_relief_query', 'Relief abfragen', 'Interroger le relief', 'Interroga rilievo', 'Query relief', 'Запит рельєфу', 'Запросить рельеф', 'Consultar relieve')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('btn_relief_reselect', 'Neu selektieren', 'Sélectionner à nouveau', 'Seleziona di nuovo', 'Reselect', 'Вибрати знову', 'Выбрать заново', 'Volver a seleccionar')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('btn_relief_cancel', 'Abbrechen', 'Annuler', 'Annulla', 'Cancel', 'Скасувати', 'Отмена', 'Cancelar')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('relief_loading', '[ * ANALYSIERE... ]', '[ * ANALYSE... ]', '[ * ANALISI... ]', '[ * ANALYZING... ]', '[ * АНАЛІЗ... ]', '[ * АНАЛИЗ... ]', '[ * ANALIZANDO... ]')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('sprache', 'Sprache:', 'Langue:', 'Lingua:', 'Language:', 'Мова:', 'Язык:', 'Idioma:')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('ausschnitt', '🌍 Ausschnitt:', '🌍 Vue:', '🌍 Vista:', '🌍 View:', '🌍 Регіон:', '🌍 Вид:', '🌍 Vista:')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('schweiz', 'Schweiz', 'Suisse', 'Svizzera', 'Switzerland', 'Швейцарія', 'Швейцария', 'Suiza')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('europa', 'Europa', 'Europe', 'Europa', 'Europe', 'Європа', 'Европа', 'Europa')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('welt', 'Welt', 'Monde', 'Mondo', 'World', 'Світ', 'Мир', 'Mundo')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('modus', 'Modus', 'Mode', 'Modalità', 'Mode', 'Режим', 'Режим', 'Modo')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('tonart', 'Tonart', 'Gamme', 'Scala', 'Scale Type', 'Лад', 'Лад', 'Escala')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wellenform', 'Patch', 'Patch', 'Patch', 'Patch', 'Патч', 'Патч', 'Patch')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('mod_gleich', 'Akkord', 'Accord', 'Accordo', 'Chord', 'Акорд', 'Аккорд', 'Acorde')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('mod_lr', 'L -> R', 'G -> D', 'S -> D', 'L -> R', 'Л -> П', 'Л -> П', 'I -> D')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('mod_rl', 'R -> L', 'D -> G', 'D -> S', 'R -> L', 'П -> Л', 'П -> Л', 'D -> I')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('raster_view', 'Raster', 'Grille', 'Griglia', 'Grid', 'Сітка', 'Сетка', 'Cuadrícula')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('scale_major', 'Dur', 'Majeur', 'Maggiore', 'Major', 'Мажор', 'Мажор', 'Mayor')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('scale_minor', 'Moll', 'Mineur', 'Minore', 'Minor', 'Мінор', 'Минор', 'Menor')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('scale_lydian', 'Lydisch', 'Lydien', 'Lidio', 'Lydian', 'Лідійський', 'Лидийский', 'Lidio')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('scale_dorian', 'Dorisch', 'Dorien', 'Dorico', 'Dorian', 'Дорійський', 'Дорийский', 'Dórico')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('scale_pentatonic', 'Pentatonik', 'Pentatonique', 'Pentatonica', 'Pentatonic', 'Пентатоніка', 'Пентатоника', 'Pentatónica')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('scale_hirajoshi', 'Hirajōshi', 'Hirajōshi', 'Hirajōshi', 'Hirajōshi', 'Хірадзьосі', 'Хирадзёси', 'Hirajōshi')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_sine', 'Sinus', 'Sinus', 'Senso', 'Sine', 'Синус', 'Синус', 'Seno')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_triangle', 'Dreieck', 'Triangle', 'Triangolo', 'Triangle', 'Трикутник', 'Треугольник', 'Triángulo')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_sawtooth', 'Sägezahn', 'Scie', 'Dente di sega', 'Sawtooth', 'Пила', 'Пила', 'Diente de sierra')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_square', 'Rechteck', 'Carré', 'Onda quadra', 'Square', 'Прямокутник', 'Квадрат', 'Cuadrada')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_organ', 'Orgel', 'Orgue', 'Organo', 'Organ', 'Орган', 'Орган', 'Órgano')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_darkpad', 'Dark Pad', 'Dark Pad', 'Dark Pad', 'Dark Pad', 'Dark Pad', 'Dark Pad', 'Dark Pad')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_chime', 'Glöckchen', 'Carillon', 'Campanelli', 'Chime', 'Дзвіночки', 'Колокольчики', 'Campanas')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_detuned_saw', 'Verstimmte Säge', 'Scie désaccordée', 'Sega scordata', 'Detuned Saw', 'Розстроєна пила', 'Расстроенная пила', 'Sierra desafinada')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('wave_noise', 'Rauschen', 'Bruit', 'Rumore', 'Noise', 'Шум', 'Шум', 'Ruido')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('gipfel', 'Gipfel', 'Sommets', 'Cime', 'Peaks', 'Вершини', 'Пики', 'Picos')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('taeler', 'Täler', 'Vallées', 'Valli', 'Valleys', 'Долини', 'Долины', 'Valles')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('abstand', 'Abstand', 'Distance', 'Distanza', 'Spacing', 'Відступ', 'Шаг', 'Espaciado')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('sensibilitaet', 'Sensib.', 'Sensib.', 'Sensib.', 'Sensib.', 'Чутлив.', 'Чувствит.', 'Sensib.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('oktaven', 'Oktaven', 'Octaves', 'Ottave', 'Octaves', 'Октави', 'Октавы', 'Octavas')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('range', 'Scale', 'Échelle', 'Scala', 'Scale', 'Шкала', 'Шкала', 'Escala')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('dauer', 'Dauer', 'Durée', 'Durata', 'Duration', 'Тривалу.', 'Длительн.', 'Duración')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('echo', 'Echo', 'Écho', 'Eco', 'Echo', 'Ехо', 'Эхо', 'Eco')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('attack', 'Attack', 'Attaque', 'Attacco', 'Attack', 'Атака', 'Атака', 'Ataque')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('release', 'Release', 'Relâche', 'Rilascio', 'Release', 'Затухан.', 'Релиз', 'Relajación')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('lautstaerke', 'Vol', 'Vol', 'Vol', 'Vol', 'Гучн.', 'Громк.', 'Vol')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('vergroessern', 'Vergrößern', 'Agrandir', 'Ingrandisci', 'Enlarge', 'Збільшити', 'Увеличить', 'Ampliar')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('prompt_name_change', 'Wie lautet dein (Spitz-)Name?', 'Quel est ton pseudonyme ?', 'Qual è il tuo soprannome?', 'What is your nickname?', 'Як ваше ім''я / псевдонім?', 'Как ваше имя / псевдоним?', '¿Cuál es tu (apodo) nombre?')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('prompt_welcome', 'Willkommen! Unter welchem (Spitz-)Namen sollen deine Presets gespeichert werden?', 'Bienvenue ! Sous quel nom souhaitez-vous enregistrer vos préréglages ?', 'Benvenuto! Con quale nome desideri salvare i tuoi preset?', 'Welcome! Under what name should your presets be saved?', 'Ласкаво просимо! Під яким ім''ям зберегти ваші налаштування?', 'Добро пожаловать! Под каким именем сохранить ваши пресеты?', '¡Bienvenido! ¿Con qué (apodo) nombre deseas guardar tus presets?')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('prompt_preset_name', 'Hallo {name}, wie soll diese Klangeinstellung heissen?', 'Bonjour {name}, quel est le nom de ce réglage ?', 'Ciao {name}, come vuoi chiamare questa impostazione?', 'Hello {name}, what should this sound setting be called?', 'Вітаю, {name}, як назвати цей пресет?', 'Привет, {name}, как назвать эту настройку?', 'Hola {name}, ¿cómo quieres llamar a este ajuste de sonido?')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_load_empty', 'Bitte markiere ein Preset zum Laden.', 'Veuillez cocher un préréglage à charger.', 'Seleziona un preset da caricare.', 'Please check a preset to load.', 'Будь ласка, виберіть пресет для завантаження.', 'Пожалуйста, выберите пресет для загрузки.', 'Por favor, marca un preset para cargar.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_load_multi', 'Zum Laden auf die Regler darf nur EIN Preset markiert sein.', 'Un seul préréglage peut être sélectionné pour le chargement.', 'È consentito selezionare un solo preset per il caricamento.', 'Only ONE preset can be checked for loading.', 'Для завантаження можна вибрати лише ОДИН пресет.', 'Для загрузки можно выбрать только ОДИН пресет.', 'Solo se puede marcar UN preset para cargar en los controles.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_saved', 'Erfolg! ''{preset}'' wurde gespeichert.', 'Succès ! ''{preset}'' a été enregistré.', 'Successo! ''{preset}'' è stato salvato.', 'Success! ''{preset}'' was saved.', 'Успіх! ''{preset}'' збережено.', 'Успех! ''{preset}'' сохранен.', '¡Éxito! ''{preset}'' ha sido guardado.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_net_error', 'Netzwerkfehler beim Speichern.', 'Erreur réseau lors de l''enregistrement.', 'Errore di rete durante il salvataggio.', 'Network error while saving.', 'Посилка мережі під час збереження.', 'Ошибка сети при сохранении.', 'Error de red al guardar.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_delete', 'Möchtest du dieses Preset wirklich löschen?', 'Voulez-vous vraiment supprimer ce préréglage ?', 'Vuoi davvero eliminare questo preset?', 'Do you really want to delete this preset?', 'Ви дійсно хочете видалити цей пресет?', 'Вы действительно хотите удалить этот пресет?', '¿Realmente deseas eliminar este preset?')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('alert_no_points', 'Mit diesen Einstellungen wurden keine Punkte gefunden!', 'Aucun point trouvé avec ces paramètres !', 'Nessun punto trovato con queste impostazioni!', 'No points found with these settings!', 'З цими налаштуваннями точок не знайдено!', 'С этими настройками точек не найдено!', '¡No se encontraron puntos con estos ajustes!')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('hint_play_current', 'Aktuelles Panorama abspielen', 'Lire le panorama actuel', 'Riproduci panorama attuale', 'Play current panorama', 'Відтворити поточну панораму', 'Воспроизвести текущую панораму', 'Reproducir panorama actual')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('hint_play_sel', 'Ausgewählte Presets abspielen', 'Lire les préréglages sélectionnés', 'Riproduci preset selezionati', 'Play selected presets', 'Відтворити вибрані пресети', 'Воспроизвести выбранные пресеты', 'Reproducir presets seleccionados')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('hint_load_sel', 'Markiertes Preset laden', 'Charger le préréglage sélectionné', 'Carica preset selezionato', 'Load selected preset', 'Завантажити вибраний пресет', 'Загрузить выбранный пресет', 'Cargar preset seleccionado')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('hint_save', 'Aktuelle Einstellung speichern', 'Enregistrer le réglage actuel', 'Salva impostazione corrente', 'Save current setting', 'Зберегти поточні налаштування', 'Сохранить текущую настройку', 'Guardar ajuste actual')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('vinyl_mode', 'Vinyl', 'Vinyle', 'Vinile', 'Vinyl', 'Вініл', 'Винил', 'Vinilo')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('vinyl_generate', 'Generieren', 'Générer', 'Generare', 'Generate', 'Згенерувати', 'Сгенерировать', 'Generar')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('vinyl_play', 'Abspielen', 'Jouer', 'Giocare', 'Play', 'Відтворити', 'Воспроизвести', 'Reproducir')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('vinyl_save', 'Speichern', 'Sauvegarder', 'Salvare', 'Save', 'Зберегти', 'Сохранить', 'Guardar')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('vinyl_load', 'Laden', 'Charger', 'Caricare', 'Load', 'Завантажити', 'Загрузить', 'Cargar')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('vinyl_mutation', 'Mutation', 'Mutation', 'Mutazione', 'Mutation', 'Мутація', 'Мутация', 'Mutación')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('relief_mode', '🏔️ Relief scannen', '🏔️ Analyser le relief', '🏔️ Scansione rilievo', '🏔️ Scan Relief', '🏔️ Сканувати рельєф', '🏔️ Сканировать рельеф', '🏔️ Escanear relieve')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('relief_guidance', 'Klicke auf der Karte auf deinen Startpunkt und wähle danach das Ziel.', 'Cliquez sur la carte sur votre point de départ puis choisissez la destination.', 'Clicca sulla mappa il tuo punto di partenza e poi scegli la destinazione.', 'Click on the map on your starting point and then choose the destination.', 'Клацніть на карті на вашу початкову точку, а потім виберіть місце призначення.', 'Нажмите на карту на начальной точке, а затем выберите пункт назначения.', 'Haz clic en el mapa en tu punto de inicio y luego elige el destino.')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES ('relief_analyzing', '[ * ANALYSIERE... ]', '[ * ANALYSE... ]', '[ * ANALISI... ]', '[ * ANALYZING... ]', '[ * АНАЛІЗ... ]', '[ * АНАЛИЗ... ]', '[ * ANALIZANDO... ]')
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;
