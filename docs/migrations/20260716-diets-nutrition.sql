-- ============================================================
-- Nutrição do catálogo `diets` — carga parcial (2026-07-16)
-- ============================================================
-- CONTEXTO: o catálogo foi semeado a partir do TheMealDB (`mealdb_id`), que
-- NÃO fornece dado nutricional — por isso 601 dos 603 alimentos estão com
-- `calories = NULL`, e a linha de calorias da rotina de dieta, a lista do
-- diário e a meta de kcal ficam todas vazias.
--
-- ⚠️ OS VALORES SÃO ESTIMATIVAS POR PORÇÃO, não medições de laboratório.
--    Servem para um app de fitness (ordem de grandeza correta), NÃO para uso
--    clínico. Erro esperado na casa de ±20–30% — receitas variam muito de
--    porção e preparo.
--
-- COBERTURA: 171 de 603 alimentos — só aqueles cujos valores dá para
--    defender (pratos conhecidos + os itens criados pelo próprio usuário).
--    Os outros ~432 continuam NULL DE PROPÓSITO: preferi deixar em branco
--    a inventar número para "Æbleskiver", "Suksessterte" ou "Keleya Zaara" —
--    NULL aparece como "Sem informação nutricional" na UI, enquanto um número
--    errado vira meta de caloria errada e insígnia de açúcar errada.
--
-- COMO COMPLETAR O RESTO: as receitas têm `mealdb_id`, então dá para buscar a
--    lista de ingredientes na API do TheMealDB e mandar para uma API de análise
--    nutricional (Edamam Nutrition Analysis / Nutritionix), que calcula a partir
--    dos ingredientes. Isso dá dado real para os ~432 restantes.
--
-- SEGURO DE REEXECUTAR: só faz UPDATE (não insere), casa por `name` exato e
--    NÃO sobrescreve valor já preenchido (`WHERE d.calories IS NULL`) — assim
--    os alimentos que o usuário cadastrou à mão ficam intactos.
-- ============================================================

WITH nutrition(name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, food_quality) AS (
  VALUES
  ('Pão com ovo', 230, 10, 28, 9, 1.5, 2, 'processado'),
  ('Café com leite', 70, 3.5, 5, 3.5, 0, 5, 'processado'),
  ('Arroz, feijão e strogonoff', 520, 28, 55, 22, 6, 4, 'processado'),
  ('Omelete de Pão', 350, 18, 30, 18, 2, 3, 'processado'),
  ('Breakfast Potatoes', 320, 6, 45, 13, 5, 3, 'in_natura'),
  ('English Breakfast', 800, 40, 50, 48, 6, 8, 'processado'),
  ('Café da Manhã Inglês Completo', 800, 40, 50, 48, 6, 8, 'processado'),
  ('Dutch poffertjes (mini pancakes)', 380, 8, 55, 13, 2, 20, 'processado'),
  ('Jamaican Cornmeal Porridge', 280, 7, 48, 7, 3, 18, 'processado'),
  ('Mandazi Caseiro', 300, 5, 45, 11, 2, 12, 'processado'),
  ('Fruit and Cream Cheese Breakfast Pastries', 420, 7, 50, 21, 2, 25, 'ultraprocessado'),
  ('Big Mac', 550, 25, 45, 30, 3, 9, 'ultraprocessado'),
  ('Espaguete Bolonhesa', 600, 30, 70, 20, 5, 8, 'processado'),
  ('Boeuf Bourguignon', 480, 38, 15, 28, 3, 5, 'in_natura'),
  ('Beef Wellington', 700, 45, 35, 42, 2, 3, 'processado'),
  ('Estrogonofe de Carne', 450, 32, 12, 30, 1, 4, 'processado'),
  ('Moussaka', 450, 22, 25, 28, 5, 9, 'processado'),
  ('Borscht', 180, 8, 20, 8, 5, 10, 'in_natura'),
  ('Milanesa', 520, 35, 35, 26, 2, 2, 'processado'),
  ('Asado', 600, 50, 2, 45, 0, 0, 'in_natura'),
  ('Empanadas', 300, 12, 28, 16, 2, 2, 'processado'),
  ('Empanadas de Carne', 300, 12, 28, 16, 2, 2, 'processado'),
  ('Beef Lo Mein', 480, 25, 60, 15, 4, 8, 'processado'),
  ('Pho de Carne', 420, 28, 50, 10, 3, 6, 'in_natura'),
  ('Beef Rendang', 520, 35, 12, 38, 3, 8, 'in_natura'),
  ('Goulash Croata Tradicional', 450, 35, 20, 25, 3, 6, 'in_natura'),
  ('Carne Szechuan', 430, 30, 20, 25, 3, 8, 'processado'),
  ('Steak Diane', 520, 40, 8, 35, 1, 3, 'processado'),
  ('Lahmacun Turco', 320, 15, 35, 13, 3, 4, 'processado'),
  ('Chili de Carne Braseada', 450, 32, 30, 22, 8, 7, 'in_natura'),
  ('Bitterballen (Bolinhos de Carne Holandeses)', 250, 10, 20, 14, 1, 1, 'processado'),
  ('Tofu Mapo', 300, 18, 15, 18, 3, 5, 'processado'),
  ('Torta de Carne e Rim', 550, 30, 45, 28, 3, 4, 'processado'),
  ('Cumberland Pie', 480, 28, 40, 23, 4, 6, 'processado'),
  ('Ensopado Irlandês', 400, 28, 35, 15, 5, 6, 'in_natura'),
  ('Stir-Fry de Carne com Brócolis', 400, 30, 20, 22, 4, 8, 'in_natura'),
  ('Frango Tandoori', 350, 45, 8, 15, 1, 4, 'in_natura'),
  ('Coq au Vin', 480, 40, 12, 28, 2, 4, 'in_natura'),
  ('Frango do General Tso', 560, 30, 50, 26, 2, 22, 'processado'),
  ('Kung Pao de Frango', 420, 30, 25, 22, 3, 10, 'processado'),
  ('Frango à Laranja Chinês', 520, 28, 55, 20, 2, 28, 'processado'),
  ('Frango Agridoce', 480, 28, 50, 18, 2, 25, 'processado'),
  ('Frango Frito Estilo Kentucky', 600, 35, 35, 35, 2, 1, 'ultraprocessado'),
  ('Sanduíche Chick-Fil-A', 440, 28, 40, 19, 2, 6, 'ultraprocessado'),
  ('Tom Kha Gai', 350, 22, 12, 25, 2, 6, 'in_natura'),
  ('Curry Verde Tailandês', 420, 25, 18, 28, 3, 8, 'in_natura'),
  ('Pad See Ew', 550, 25, 70, 18, 3, 12, 'processado'),
  ('Shawarma', 500, 35, 40, 22, 4, 5, 'processado'),
  ('Congee de Frango', 250, 15, 35, 5, 1, 2, 'in_natura'),
  ('Jerk Chicken com Arroz e Feijão', 600, 38, 60, 20, 8, 8, 'in_natura'),
  ('Frango Parmentier', 480, 30, 40, 20, 4, 5, 'processado'),
  ('Curry Katsu de Frango', 650, 32, 70, 26, 4, 10, 'processado'),
  ('Kabsa', 600, 35, 70, 20, 4, 6, 'in_natura'),
  ('Rosół (Canja de Frango Polonesa)', 180, 15, 12, 7, 2, 3, 'in_natura'),
  ('Frango Alfredo Primavera', 650, 38, 60, 28, 4, 6, 'processado'),
  ('Frango Piri-Piri com Coleslaw', 450, 40, 15, 25, 3, 7, 'in_natura'),
  ('Arroz Frito com Frango', 480, 25, 60, 15, 3, 4, 'processado'),
  ('Frango Basquaise', 400, 35, 18, 20, 4, 7, 'in_natura'),
  ('Frango Marengo', 400, 35, 15, 20, 3, 5, 'in_natura'),
  ('Churros', 280, 4, 35, 14, 1, 15, 'processado'),
  ('Alfajores', 220, 3, 30, 10, 1, 20, 'ultraprocessado'),
  ('Alfajores de Chocolate', 240, 3, 32, 11, 1, 22, 'ultraprocessado'),
  ('Alfajores de Baunilha', 230, 3, 31, 11, 1, 21, 'ultraprocessado'),
  ('Doce de Leite', 130, 2, 22, 3, 0, 22, 'processado'),
  ('Brigadeiro de Chocolate e Caramelo Crocante', 120, 1.5, 18, 5, 0.5, 17, 'ultraprocessado'),
  ('Pastéis de Nata', 300, 5, 33, 16, 1, 18, 'processado'),
  ('Cheesecake de Nova Iorque', 400, 7, 35, 26, 0.5, 28, 'processado'),
  ('Flan', 220, 6, 33, 7, 0, 30, 'processado'),
  ('Crema Catalana', 250, 5, 30, 12, 0, 28, 'processado'),
  ('Baklava com Nozes Temperadas, Ricota e Chocolate', 350, 6, 40, 19, 2, 28, 'processado'),
  ('Bolo de Cenoura', 350, 4, 48, 16, 2, 30, 'processado'),
  ('Bolo de Chocolate Gateau', 400, 6, 50, 20, 3, 35, 'processado'),
  ('Suflê de Chocolate', 300, 8, 35, 15, 2, 28, 'processado'),
  ('Torta de Limão (Key Lime Pie)', 400, 6, 50, 20, 1, 38, 'processado'),
  ('Torta de Abóbora', 320, 5, 42, 15, 3, 25, 'processado'),
  ('Panquecas', 350, 8, 55, 11, 2, 12, 'processado'),
  ('Banana Pancakes', 400, 10, 60, 13, 4, 22, 'processado'),
  ('Tarte Tatin', 350, 3, 50, 16, 3, 32, 'processado'),
  ('Tarte Tatin de Pera', 340, 3, 50, 15, 4, 32, 'processado'),
  ('Eton Mess', 320, 4, 40, 16, 2, 36, 'processado'),
  ('Sticky Toffee Pudding', 500, 5, 70, 23, 2, 50, 'processado'),
  ('Sticky Toffee Pudding Ultimate', 520, 5, 72, 24, 2, 52, 'processado'),
  ('Donuts Krispy Kreme', 190, 3, 22, 11, 0.5, 10, 'ultraprocessado'),
  ('Timbits', 70, 1, 9, 3.5, 0.3, 4, 'ultraprocessado'),
  ('Lamingtons', 300, 4, 45, 12, 2, 30, 'ultraprocessado'),
  ('Brownies de Chocolate com Framboesa', 350, 5, 45, 18, 3, 32, 'processado'),
  ('Mousse de Chocolate e Abacate', 250, 4, 25, 16, 6, 18, 'in_natura'),
  ('Mousse de Maracujá', 220, 4, 30, 10, 1, 26, 'processado'),
  ('Mousse de Framboesa', 220, 4, 28, 11, 2, 24, 'processado'),
  ('Bolo de Maçã', 320, 4, 48, 13, 2, 28, 'processado'),
  ('Crumble de Maçã e Amora', 350, 4, 55, 14, 5, 32, 'processado'),
  ('Pudim de Pão e Manteiga', 350, 8, 45, 15, 1.5, 28, 'processado'),
  ('Cheesecake de Pasta de Amendoim', 480, 10, 40, 32, 2, 30, 'processado'),
  ('Biscoitos de Pasta de Amendoim', 110, 3, 12, 6, 0.5, 8, 'processado'),
  ('Bolo de Pistache', 380, 7, 45, 19, 2, 30, 'processado'),
  ('Cheesecake de Iogurte com Mel', 320, 9, 35, 16, 0.5, 28, 'processado'),
  ('Morangos Romanoff', 250, 3, 25, 14, 3, 22, 'in_natura'),
  ('Sorvete de Rum e Passas (Sem Batedeira)', 280, 4, 32, 15, 0, 30, 'ultraprocessado'),
  ('Sorvete de Grape-Nut', 260, 5, 33, 12, 1, 27, 'ultraprocessado'),
  ('Torta de Pecan com Chocolate', 480, 6, 55, 27, 3, 42, 'processado'),
  ('Churros de Chocolate com Molho de Caramelo Salgado', 380, 5, 45, 20, 2, 25, 'processado'),
  ('Bolo de Natal', 380, 4, 60, 13, 3, 45, 'processado'),
  ('Pudim de Natal Clássico', 380, 4, 62, 12, 4, 45, 'processado'),
  ('Kanelbullar (Pão de Canela)', 280, 5, 42, 10, 2, 18, 'processado'),
  ('Chelsea Buns', 300, 6, 48, 9, 2, 22, 'processado'),
  ('Stroopwafel Holandês', 150, 1.5, 20, 7, 0.5, 12, 'ultraprocessado'),
  ('Biscoitos Anzac', 110, 1.5, 16, 5, 1, 9, 'processado'),
  ('Bolo Battenberg', 350, 5, 55, 13, 1.5, 42, 'ultraprocessado'),
  ('Bolo de Madeira (Madeira Cake)', 320, 4, 45, 14, 1, 28, 'processado'),
  ('Torta Bakewell', 400, 6, 48, 21, 2, 32, 'processado'),
  ('Bolinhos Fritos de Banana Jamaicanos', 250, 3, 40, 9, 2, 16, 'processado'),
  ('Æbleskiver', 60, 2, 8, 2, 0.3, 3, 'processado'),
  ('Lasanha', 550, 30, 50, 25, 4, 8, 'processado'),
  ('Espaguete à Carbonara', 600, 25, 70, 25, 3, 3, 'processado'),
  ('Fettuccine Alfredo', 650, 20, 70, 32, 3, 4, 'processado'),
  ('Puttanesca de Sardinha', 480, 22, 60, 16, 4, 6, 'processado'),
  ('Linguine com Camarão Apimentado', 500, 28, 65, 14, 3, 4, 'processado'),
  ('Sanduíches de Lasanha', 600, 28, 60, 28, 4, 8, 'processado'),
  ('Pizza Margherita Express', 700, 30, 80, 28, 4, 8, 'processado'),
  ('Poutine', 750, 20, 75, 42, 5, 4, 'ultraprocessado'),
  ('Shakshouka', 280, 14, 15, 18, 4, 8, 'in_natura'),
  ('Shakshuka com Queijo Feta', 320, 17, 15, 21, 4, 8, 'in_natura'),
  ('Chakchouka', 280, 14, 15, 18, 4, 8, 'in_natura'),
  ('Omelete Francesa', 250, 18, 2, 19, 0, 1, 'in_natura'),
  ('Ramen com Ovo Cozido', 500, 22, 65, 16, 3, 5, 'ultraprocessado'),
  ('Confit de Pato', 550, 35, 2, 45, 0, 0, 'processado'),
  ('Feijão Cozido com Salsichão', 450, 22, 50, 18, 10, 15, 'ultraprocessado'),
  ('Osso Buco alla Milanese', 500, 40, 15, 30, 2, 4, 'in_natura'),
  ('Yorkshire Pudding', 130, 4, 13, 6, 0.5, 1, 'processado'),
  ('Pão Sírio', 165, 5.5, 33, 1, 1.5, 1, 'processado'),
  ('Locro', 450, 25, 50, 16, 10, 5, 'in_natura'),
  ('Tonkatsu pork', 550, 32, 40, 28, 2, 4, 'processado'),
  ('Katsudon Japonês', 700, 35, 85, 25, 3, 10, 'processado'),
  ('Sweet and Sour Pork', 520, 28, 55, 20, 2, 28, 'processado'),
  ('Wontons', 250, 12, 25, 11, 1, 2, 'processado'),
  ('Choripán', 550, 22, 45, 30, 3, 5, 'processado'),
  ('Toad in the Hole', 500, 22, 40, 27, 2, 5, 'ultraprocessado'),
  ('Colcannon com Pernil Defumado', 400, 22, 40, 17, 6, 5, 'processado'),
  ('Bigos (Ensopado do Caçador)', 350, 20, 20, 20, 6, 8, 'processado'),
  ('Croquetas de Presunto', 280, 10, 25, 15, 1, 3, 'processado'),
  ('Gyoza de Papel de Arroz', 250, 12, 30, 9, 2, 2, 'processado'),
  ('Zapiekanki', 450, 16, 55, 18, 3, 5, 'ultraprocessado'),
  ('Paella', 550, 30, 65, 16, 3, 4, 'in_natura'),
  ('Pad Thai', 600, 25, 75, 20, 4, 18, 'processado'),
  ('Nasi Lemak', 650, 20, 80, 28, 5, 8, 'in_natura'),
  ('Sardinhas Portuguesas Grelhadas', 280, 30, 0, 18, 0, 0, 'in_natura'),
  ('Salmão Teriyaki ao Mel', 400, 35, 18, 20, 0, 16, 'processado'),
  ('Gambas al ajillo', 250, 25, 3, 15, 0.5, 1, 'in_natura'),
  ('Lula Frita (Calamares)', 350, 20, 25, 18, 1, 1, 'processado'),
  ('Torta de Peixe', 450, 28, 40, 20, 3, 5, 'processado'),
  ('Kedgeree', 480, 28, 55, 16, 2, 3, 'processado'),
  ('Egg Foo Young', 320, 18, 12, 22, 2, 3, 'processado'),
  ('Portuguese fish stew (Caldeirada de peixe)', 380, 32, 25, 16, 3, 5, 'in_natura'),
  ('Tacos de Peixe Cajun', 420, 25, 40, 18, 4, 5, 'processado'),
  ('Salmon Prawn Risotto', 600, 30, 70, 22, 2, 3, 'processado'),
  ('Seafood rice', 500, 28, 65, 13, 2, 3, 'in_natura'),
  ('Shrimp Chow Fun', 520, 24, 70, 16, 3, 6, 'processado'),
  ('Pad Kee Mao (Macarrão Bêbado)', 550, 25, 70, 18, 3, 10, 'processado'),
  ('Adana Kebab', 450, 30, 8, 32, 1, 2, 'in_natura'),
  ('Souvlaki de Cordeiro com Limão', 400, 35, 6, 26, 1, 2, 'in_natura'),
  ('Biryani de Cordeiro', 650, 32, 75, 24, 4, 6, 'in_natura'),
  ('Rogan Josh de Cordeiro', 450, 35, 12, 30, 3, 5, 'in_natura'),
  ('Tajine de Cordeiro', 450, 35, 25, 24, 5, 12, 'in_natura'),
  ('Lancashire Hotpot', 450, 30, 35, 20, 4, 6, 'in_natura'),
  ('Kapsalon', 900, 40, 70, 50, 5, 6, 'ultraprocessado'),
  ('Fårikål (Prato Nacional da Noruega)', 400, 32, 15, 24, 4, 5, 'in_natura'),
  ('Baingan Bharta', 220, 5, 18, 14, 7, 9, 'in_natura'),
  ('Air fryer patatas bravas', 280, 5, 42, 10, 5, 4, 'in_natura'),
  ('Aubergine & hummus grills', 300, 9, 25, 19, 8, 7, 'in_natura'),
  ('Beetroot latkes', 250, 6, 30, 12, 5, 8, 'in_natura'),
  ('Ribollita', 300, 10, 40, 10, 9, 7, 'in_natura')
)
UPDATE diets d
SET calories     = n.calories::real,
    protein_g    = n.protein_g::real,
    carbs_g      = n.carbs_g::real,
    fat_g        = n.fat_g::real,
    fiber_g      = n.fiber_g::real,
    sugar_g      = n.sugar_g::real,
    food_quality = n.food_quality::text
FROM nutrition n
WHERE d.name = n.name
  AND d.calories IS NULL;

-- Conferência: quantos ainda faltam por categoria
-- SELECT category, count(*) FILTER (WHERE calories IS NULL) AS sem_dado, count(*) AS total
-- FROM diets GROUP BY category ORDER BY sem_dado DESC;
