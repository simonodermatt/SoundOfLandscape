-- ==============================================================
-- Supabase Migration: Alle AI/KI-Übersetzungen auf Jodel/Yodel umstellen
-- + Neue Jodel- & Warm-Paper-UI-Keys für alle 7 Sprachen (de, fr, it, en, uk, ru, es)
-- Idempotent (kann beliebig oft im Supabase SQL-Editor ausgeführt werden)
-- ==============================================================

-- 1. Bestehende AI-Meldungen auf Jodel umstellen
INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'alert_ai_error',
    'Fehler bei der Jodel-Generierung.',
    'Erreur lors de la génération du jodel.',
    'Errore durante la generazione dello jodel.',
    'Error during yodel generation.',
    'Помилка під час генерації йодлю.',
    'Ошибка при генерации йодля.',
    'Error en la generación del jodel.'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'alert_gen_ai_seq_first',
    'Bitte generiere zuerst eine Jodel-Sequenz (Berg-Symbol)!',
    'Veuillez d''abord générer une séquence de jodel (icône montagne) !',
    'Genera prima una sequenza jodel (icona montagna)!',
    'Please generate a yodel sequence first (mountain icon)!',
    'Будь ласка, спершу згенеруйте послідовність йодлю (іконка гори)!',
    'Пожалуйста, сначала сгенерируйте последовательность йодля (иконка горы)!',
    '¡Por favor, genera primero una secuencia de jodel (icono de montaña)!'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'alert_gen_ai_comp_first',
    'Bitte klicke zuerst auf das Berg-Symbol, um die Jodel-Stimme zu generieren.',
    'Veuillez d''abord cliquer sur l''icône montagne pour générer la voix jodel.',
    'Clicca prima sull''icona della montagna per generare la voce jodel.',
    'Please click the mountain icon first to generate the yodel voice.',
    'Будь ласка, спершу натисніть на іконку гори, щоб згенерувати голос йодлю.',
    'Пожалуйста, сначала нажмите на иконку горы, чтобы сгенерировать голос йодля.',
    'Por favor, haz clic primero en el icono de la montaña para generar la voz de jodel.'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

-- 2. Neue Jodel-UI-Keys & Warm-Paper-Label
INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'hint_jodel_gen',
    'Schritt 1: Jodel-Stimme aus Kontur berechnen',
    'Étape 1 : Calculer la voix jodel depuis le contour',
    'Passo 1: Calcola la voce jodel dal contorno',
    'Step 1: Generate yodel voice from contour',
    'Крок 1: Згенерувати голос йодлю з контуру',
    'Шаг 1: Сгенерировать голос йодля из контура',
    'Paso 1: Generar voz de jodel desde el contorno'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'hint_jodel_play',
    'Schritt 2: Jodel-Stimme abspielen',
    'Étape 2 : Lire la voix jodel',
    'Passo 2: Riproduci la voce jodel',
    'Step 2: Play yodel voice',
    'Крок 2: Відтворити голос йодлю',
    'Шаг 2: Воспроизвести голос йодля',
    'Paso 2: Reproducir voz de jodel'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'jodel_voice_label',
    'Stimme (M↔F)',
    'Voix (H↔F)',
    'Voce (U↔D)',
    'Voice (M↔F)',
    'Голос (Ч↔Ж)',
    'Голос (М↔Ж)',
    'Voz (H↔M)'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'jodel_jump_label',
    'Jodelsprung',
    'Saut jodel',
    'Salto jodel',
    'Yodel jump',
    'Стрибок йодлю',
    'Йодль-прыжок',
    'Salto jodel'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'jodel_badge_label',
    '⛰ Jodel',
    '⛰ Jodel',
    '⛰ Jodel',
    '⛰ Yodel',
    '⛰ Йодль',
    '⛰ Йодль',
    '⛰ Jodel'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;

INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
VALUES (
    'wave_warm_paper',
    'Warm Paper',
    'Warm Paper',
    'Warm Paper',
    'Warm Paper',
    'Warm Paper',
    'Warm Paper',
    'Warm Paper'
)
ON CONFLICT (key_name) DO UPDATE SET
    de = EXCLUDED.de,
    fr = EXCLUDED.fr,
    it = EXCLUDED.it,
    en = EXCLUDED.en,
    uk = EXCLUDED.uk,
    ru = EXCLUDED.ru,
    es = EXCLUDED.es;
