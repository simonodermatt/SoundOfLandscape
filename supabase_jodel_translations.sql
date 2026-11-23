-- ==============================================================
-- Supabase Migration: Alle AI/KI-Übersetzungen auf Jodel/Yodel umstellen
-- + Neue Jodel- & Warm-Paper-UI-Keys für alle 7 Sprachen (de, fr, it, en, uk, ru, es)
-- Nutzt UPDATE + INSERT WHERE NOT EXISTS (kein ON CONFLICT nötig, verhindert 23505).
-- ==============================================================

WITH new_translations (key_name, de, fr, it, en, uk, ru, es) AS (
    VALUES
        (
            'alert_ai_error',
            'Fehler bei der Jodel-Generierung.',
            'Erreur lors de la génération du jodel.',
            'Errore durante la generazione dello jodel.',
            'Error during yodel generation.',
            'Помилка під час генерації йодлю.',
            'Ошибка при генерации йодля.',
            'Error en la generación del jodel.'
        ),
        (
            'alert_gen_ai_seq_first',
            'Bitte generiere zuerst eine Jodel-Sequenz (Berg-Symbol)!',
            'Veuillez d''abord générer une séquence de jodel (icône montagne) !',
            'Genera prima una sequenza jodel (icona montagna)!',
            'Please generate a yodel sequence first (mountain icon)!',
            'Будь ласка, спершу згенеруйте послідовність йодлю (іконка гори)!',
            'Пожалуйста, сначала сгенерируйте последовательность йодля (иконка горы)!',
            '¡Por favor, genera primero una secuencia de jodel (icono de montaña)!'
        ),
        (
            'alert_gen_ai_comp_first',
            'Bitte klicke zuerst auf das Berg-Symbol, um die Jodel-Stimme zu generieren.',
            'Veuillez d''abord cliquer sur l''icône montagne pour générer la voix jodel.',
            'Clicca prima sull''icona della montagna per generare la voce jodel.',
            'Please click the mountain icon first to generate the yodel voice.',
            'Будь ласка, спершу натисніть на іконку гори, щоб згенерувати голос йодлю.',
            'Пожалуйста, сначала нажмите на іконку горы, чтобы сгенерировать голос йодля.',
            'Por favor, haz clic primero en el icono de la montaña para generar la voz de jodel.'
        ),
        (
            'hint_jodel_gen',
            'Schritt 1: Jodel-Stimme aus Kontur berechnen',
            'Étape 1 : Calculer la voix jodel depuis le contour',
            'Passo 1: Calcola la voce jodel dal contorno',
            'Step 1: Generate yodel voice from contour',
            'Крок 1: Згенерувати голос йодлю з контуру',
            'Шаг 1: Сгенерировать голос йодля из контура',
            'Paso 1: Generar voz de jodel desde el contorno'
        ),
        (
            'hint_jodel_play',
            'Schritt 2: Jodel-Stimme abspielen',
            'Étape 2 : Lire la voix jodel',
            'Passo 2: Riproduci la voce jodel',
            'Step 2: Play yodel voice',
            'Крок 2: Відтворити голос йодлю',
            'Шаг 2: Воспроизвести голос йодля',
            'Paso 2: Reproducir voz de jodel'
        ),
        (
            'jodel_voice_label',
            'Stimme (M↔F)',
            'Voix (H↔F)',
            'Voce (U↔D)',
            'Voice (M↔F)',
            'Голос (Ч↔Ж)',
            'Голос (М↔Ж)',
            'Voz (H↔M)'
        ),
        (
            'jodel_jump_label',
            'Jodelsprung',
            'Saut jodel',
            'Salto jodel',
            'Yodel jump',
            'Стрибок йодлю',
            'Йодль-прыжок',
            'Salto jodel'
        ),
        (
            'jodel_badge_label',
            '⛰ Jodel',
            '⛰ Jodel',
            '⛰ Jodel',
            '⛰ Yodel',
            '⛰ Йодль',
            '⛰ Йодль',
            '⛰ Jodel'
        ),
        (
            'wave_warm_paper',
            'Warm Paper',
            'Warm Paper',
            'Warm Paper',
            'Warm Paper',
            'Warm Paper',
            'Warm Paper',
            'Warm Paper'
        )
),
updated AS (
    UPDATE translations AS t
    SET
        de = n.de,
        fr = n.fr,
        it = n.it,
        en = n.en,
        uk = n.uk,
        ru = n.ru,
        es = n.es
    FROM new_translations AS n
    WHERE t.key_name = n.key_name
    RETURNING t.key_name
)
INSERT INTO translations (key_name, de, fr, it, en, uk, ru, es)
SELECT n.key_name, n.de, n.fr, n.it, n.en, n.uk, n.ru, n.es
FROM new_translations AS n
WHERE NOT EXISTS (
    SELECT 1 FROM translations AS t WHERE t.key_name = n.key_name
);
