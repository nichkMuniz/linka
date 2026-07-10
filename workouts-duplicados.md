# Exercícios duplicados — tabela `workouts`

Gerado em 2026-07-07 a partir de 470 registros.

Legenda: **MANTER** = sugestão de registro a preservar (tem referências de usuários, ou é o registro original do catálogo). Os demais do grupo são candidatos a exclusão.

⚠️ Registros com referências em `user_workouts` ou `user_workouts_hist` **não devem ser apagados sem antes remapear** o `workout_id` para o registro mantido.

## 1. Duplicados exatos (mesmo nome PT)

### Agachamento com Barra (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `86638b09-677f-4569-9fa4-812c4a0c7cad` | Barbell Squat | Pernas | catálogo | 2026-04-02 | — |
| apagar | `19aa2df7-344e-46ce-8e68-cbebda04a188` | Barbell Squat | Pernas | catálogo | 2026-04-02 | — |

### Agachamento Split na Máquina Smith (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `f9d60973-72b8-47ea-bbff-c0554400ca2f` | Smith Machine Split Squat | Pernas | catálogo | 2026-04-02 | — |
| apagar | `6b324ca9-d699-4f5a-89c2-57aec5cee6af` | Smith Machine Split Squat | Pernas | catálogo | 2026-04-02 | — |

### Barra fixa (14 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `a1f8d900-c903-4107-8534-30e1f8a01baa` | Pull-up | Costas | usuário | 2026-07-01 | 1 em user_workouts, 12 no histórico |
| apagar | `077b059d-0102-436a-896e-b81e1bd99bce` | Pull-up | Costas | usuário | 2026-06-11 | — |
| apagar | `c6babd1d-e3ac-485a-92ee-fdf3549c2b73` | Pull-up | Costas | usuário | 2026-06-18 | — |
| apagar | `4b17616c-30c1-4a5e-89b9-703908c54eae` | Pull-up | Costas | usuário | 2026-06-22 | — |
| apagar | `23f55f6d-5c31-4689-9468-49ad7c32b249` | Pull-up | Costas | usuário | 2026-06-22 | — |
| apagar | `0735a115-26b8-4106-8863-10b93f344712` | Pull-up | Costas | usuário | 2026-06-22 | — |
| apagar | `28437484-a0ed-4c71-b29f-8caae4dd0624` | Pull-up | Costas | usuário | 2026-06-22 | — |
| apagar | `42189604-1488-4ec0-bd4e-3c46c90c1e1f` | Pull-up | Costas | usuário | 2026-06-22 | — |
| apagar | `7732f123-2cf6-4627-b8d2-9d7a7e013e16` | Pull-up | Costas | usuário | 2026-06-22 | — |
| apagar | `148506da-7291-4dd5-a196-64aaf852e0aa` | Pull-up | Costas | usuário | 2026-06-25 | — |
| apagar | `51cc7384-3f84-4007-897b-ec5b2e787250` | Pull-up | Costas | usuário | 2026-06-29 | — |
| apagar | `cf4622e1-aa1d-4ab8-b7f4-e9c5859884d0` | Pull-up | Costas | usuário | 2026-06-29 | — |
| apagar | `4185412e-39a4-47a1-9acd-6cb9f4f8800c` | Pull-up | Costas | usuário | 2026-06-29 | — |
| apagar | `54c052f4-633d-4a21-af94-555d5a69c9fa` | Pull-up | Costas | usuário | 2026-06-30 | — |

### Cadeira extensora (15 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `9520276f-bbc6-4509-8836-add027b521f1` | Leg Extension | Pernas | usuário | 2026-07-01 | 1 em user_workouts |
| ⚠️ remapear antes | `58be08c5-c7fd-42a2-aea9-5d3ee8eee05a` | — | Pernas | usuário | 2026-07-06 | 1 em user_workouts |
| apagar | `6b9aa09c-fcba-45ff-b57c-12c3fede10ee` | Leg Extension | Pernas | catálogo | 2026-07-07 | — |
| apagar | `e0f42744-6dcd-45c6-8cb6-185eb6d053ee` | Leg Extension | Pernas | usuário | 2026-06-11 | — |
| apagar | `3d1a5246-b544-4217-a51f-46152af7465e` | Leg Extension | Pernas | usuário | 2026-06-22 | — |
| apagar | `c68713e0-a306-402a-acf5-d145e9cd3cb9` | Leg Extension | Pernas | usuário | 2026-06-22 | — |
| apagar | `e218b332-d448-4dd2-a366-57e9d9f03486` | Leg Extension | Pernas | usuário | 2026-06-22 | — |
| apagar | `bb35b82a-778f-4fdd-b834-f944113a830a` | Leg Extension | Pernas | usuário | 2026-06-22 | — |
| apagar | `553e9f7b-2b56-48d1-8279-748eadb15ae6` | Leg Extension | Pernas | usuário | 2026-06-22 | — |
| apagar | `846771f9-05a6-4575-a54a-44310b3dfa93` | Leg Extension | Pernas | usuário | 2026-06-22 | — |
| apagar | `02f92e3d-4ea2-45fe-87a6-aa87bb7d1abd` | Leg Extension | Pernas | usuário | 2026-06-25 | — |
| apagar | `42a26e60-331d-4fa6-948d-148b202e5c44` | Leg Extension | Pernas | usuário | 2026-06-29 | — |
| apagar | `beeca397-2df4-4d09-994e-db7e1662f662` | Leg Extension | Pernas | usuário | 2026-06-29 | — |
| apagar | `915d1398-4d1a-4a1d-8e5c-4f8718e4dddc` | Leg Extension | Pernas | usuário | 2026-06-29 | — |
| apagar | `58bef78d-53f1-4bb3-bb35-50ea1d9b3b25` | Leg Extension | Pernas | usuário | 2026-06-30 | — |

### Crossover (15 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `62dee995-557e-4723-b6e6-eacefd53f6d8` | Cable Crossover | Peito | usuário | 2026-07-01 | 1 em user_workouts |
| apagar | `d83455cc-8e94-49ff-8d25-fff502e5dd8a` | Cable Crossover | Peito | usuário | 2026-06-09 | — |
| apagar | `54aa5a99-4acd-477a-a9ba-cdc1d5013e2d` | Cable Crossover | Peito | usuário | 2026-06-11 | — |
| apagar | `a1493547-1582-4068-aa39-ddee27e2c18a` | Cable Crossover | Peito | usuário | 2026-06-18 | — |
| apagar | `da11f402-faa4-4432-9773-a3dc4ed853ea` | Cable Crossover | Peito | usuário | 2026-06-22 | — |
| apagar | `fc874a4e-84db-4195-a9d9-99156ad67a19` | Cable Crossover | Peito | usuário | 2026-06-22 | — |
| apagar | `8cdaacab-d958-49a8-aeb1-401822ee7c7a` | Cable Crossover | Peito | usuário | 2026-06-22 | — |
| apagar | `a2a642c2-d529-4418-ab8c-1d73c95d8c36` | Cable Crossover | Peito | usuário | 2026-06-22 | — |
| apagar | `c1b2a612-d854-4f79-a8fd-3e499c0a617b` | Cable Crossover | Peito | usuário | 2026-06-22 | — |
| apagar | `73a385a9-e271-418b-aed2-c3aba0cb4bfd` | Cable Crossover | Peito | usuário | 2026-06-22 | — |
| apagar | `b1d255f1-a8e3-4390-a054-efb84b30773f` | Cable Crossover | Peito | usuário | 2026-06-25 | — |
| apagar | `8df4738c-9e38-4f82-a806-7adfab8ef101` | Cable Crossover | Peito | usuário | 2026-06-29 | — |
| apagar | `4535c2e1-0d52-42de-8e02-90cd4e0df234` | Cable Crossover | Peito | usuário | 2026-06-29 | — |
| apagar | `b0054f6e-8097-46b9-a802-bfa8235b5826` | Cable Crossover | Peito | usuário | 2026-06-29 | — |
| apagar | `e59eeabb-55c2-4e0f-b6d8-f638cdc2bc6c` | Cable Crossover | Peito | usuário | 2026-06-30 | — |

### Desenvolvimento militar (17 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `48f5b756-3956-458b-a0fa-506e1f7377df` | Military Press | Ombros | usuário | 2026-07-01 | 1 em user_workouts, 8 no histórico |
| ⚠️ remapear antes | `19bbc58f-f44e-4012-af0f-b7117c68cb3a` | — | Ombros | usuário | 2026-07-06 | 1 em user_workouts |
| apagar | `08d21c81-d646-44c5-9e53-de98d64450a4` | Military Press | Ombros | catálogo | 2026-07-07 | — |
| apagar | `333329a3-3175-4221-8d1d-e82e917ab608` | Military Press | Ombros | usuário | 2026-06-09 | — |
| apagar | `bb606bdb-4dea-4570-be37-755ff1131f48` | Military Press | Ombros | usuário | 2026-06-11 | — |
| apagar | `c1d3abaa-8ed9-4fd3-84ba-b5caf83ea2d6` | Military Press | Ombros | usuário | 2026-06-18 | — |
| apagar | `78070d3d-9afc-415e-86a3-0c033cf2727b` | Military Press | Ombros | usuário | 2026-06-22 | — |
| apagar | `cb6a35f1-6719-412e-bd71-93b4e003cf2b` | Military Press | Ombros | usuário | 2026-06-22 | — |
| apagar | `611c6745-d954-466f-91a7-3cb638f47080` | Military Press | Ombros | usuário | 2026-06-22 | — |
| apagar | `8b289457-9730-45c3-9a86-ec43d599b5ac` | Military Press | Ombros | usuário | 2026-06-22 | — |
| apagar | `7c494eec-1ddd-4fa0-9316-25e9e5136b93` | Military Press | Ombros | usuário | 2026-06-22 | — |
| apagar | `16afd307-7e92-4ad8-8aa1-59108df4b4cf` | Military Press | Ombros | usuário | 2026-06-22 | — |
| apagar | `7d5b221f-66d4-4f4f-92cc-f5db812e9e5a` | Military Press | Ombros | usuário | 2026-06-25 | — |
| apagar | `098433c7-f46b-4e93-8f9c-ad05e3fbaca2` | Military Press | Ombros | usuário | 2026-06-29 | — |
| apagar | `54998ffe-d4e6-4ab8-a46f-b2fa90682e65` | Military Press | Ombros | usuário | 2026-06-29 | — |
| apagar | `a9b58886-04ad-40fe-a078-b48088e56f8e` | Military Press | Ombros | usuário | 2026-06-29 | — |
| apagar | `178774d5-b51f-43c9-9faf-5bc423a46503` | Military Press | Ombros | usuário | 2026-06-30 | — |

### Elevação de Quadril com Halter (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `94985393-3c5c-40e0-9661-1417dc053abc` | Dumbbell Hip Thrust | Pernas | catálogo | 2026-04-02 | — |
| apagar | `acfdfa11-9b9c-4616-849f-dfb70f79cf37` | Dumbbell Hip Thrust | Pernas | catálogo | 2026-04-02 | — |

### Elevação Lateral (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `65c5ed0d-d1f1-4399-9643-e4d3068bfaf6` | Lateral Raise | Ombros | catálogo | 2026-04-02 | 2 em user_workouts, 11 no histórico |
| apagar | `c6107772-a9ed-4fba-a8e9-259019fb2855` | Lateral Raise | Ombros | usuário | 2026-06-09 | — |

### Elevação lateral na máquina (3 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `1f3a04a4-aef9-4a9f-b169-b0fd2196ba21` | Machine Lateral Raise | Ombros | catálogo | 2026-05-11 | 4 no histórico |
| apagar | `1b50f330-3244-43f2-8da4-69759b8fc27f` | Machine Lateral Raise | Ombros | catálogo | 2026-04-02 | — |
| apagar | `927c9236-920c-40b4-b181-bbf7ae4d64a1` | Machine Lateral Raise | Ombros | catálogo | 2026-04-02 | — |

### Encolhimento Abdominal Sentado (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `89976b9b-89ae-43bd-ac7c-72dfcec827f5` | Seated Ab Crunch | Abdômen | catálogo | 2026-04-02 | — |
| apagar | `e1fd3066-0e40-480e-b977-73e2792ea771` | Seated Ab Crunch | Abdômen | catálogo | 2026-04-17 | — |

### Encolhimento com Halteres (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `b129880a-6e6a-42c1-bc8b-023025ccd651` | Dumbbell Shrug | Ombros | catálogo | 2026-04-02 | — |
| apagar | `a3be0fc5-d04e-4de8-99ca-2007397ccc0c` | Dumbbell Shrug | Ombros | catálogo | 2026-04-02 | — |

### Extensão de Joelho (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `f9d2da23-4a49-430a-81a6-a0edfef94ec9` | Knee Extension | Pernas | catálogo | 2026-04-02 | 4 no histórico |
| apagar | `cf2dffe1-f6c0-454e-ac66-8e14771909da` | Knee Extension | Pernas | catálogo | 2026-04-02 | — |

### Extensão de Tríceps acima da Cabeça (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `dbd3ecb2-f064-4ff8-82f5-665e6e124206` | Overhead Triceps Extension | Braços | catálogo | 2026-04-02 | — |
| apagar | `bcccdb35-cc99-4d03-9595-3150aecdbde0` | Overhead Triceps Extension | Braços | catálogo | 2026-05-06 | — |

### Flexão de Braço (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `c0f3419d-b866-4b4e-b79f-5e0e2840a171` | Push-up | Peito | catálogo | 2026-04-02 | — |
| apagar | `2a248edc-26c6-4f6b-8a8a-7ae36185294a` | Push-up | Peito | catálogo | 2026-04-02 | — |

### Flexão Declinada (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `9b1bb729-1dff-4de2-b4da-7e780d3821d5` | Decline Push-up | Peito | catálogo | 2026-04-02 | — |
| apagar | `a12bb9f1-2fc0-4d34-9d14-cef0582ac2ae` | Decline Push-up | Peito | catálogo | 2026-04-02 | — |

### Flexão Diamante (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `539129dc-7658-4f9a-b64e-84963885ac8b` | Diamond Push-up | Braços | catálogo | 2026-04-02 | — |
| apagar | `1aa9b051-a283-46f4-b2f8-3ff60cd0b5f8` | Diamond Push-up | Braços | catálogo | 2026-04-18 | — |

### Levantamento Terra Romeno com Halteres (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `2115a792-1158-4558-9904-8d9860ad4e17` | Dumbbell Romanian Deadlift | Pernas | catálogo | 2026-04-02 | — |
| apagar | `1c7ee82f-5e57-4fee-a543-a5101cbd446e` | Dumbbell Romanian Deadlift | Pernas | catálogo | 2026-04-02 | — |

### Mesa flexora (15 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `57443fb6-b2a0-4454-91d0-18205738c4c4` | Lying Leg Curl | Pernas | usuário | 2026-07-01 | 1 em user_workouts |
| ⚠️ remapear antes | `af15213a-026e-46d6-b771-acbec7603d0a` | — | Pernas | usuário | 2026-07-06 | 1 em user_workouts |
| apagar | `489f43a0-e3ea-4ade-8ae0-af97f4808c05` | Lying Leg Curl | Pernas | catálogo | 2026-07-07 | — |
| apagar | `8c992f56-a35a-4db8-b984-0465d2231b93` | Lying Leg Curl | Pernas | usuário | 2026-06-11 | — |
| apagar | `6600f9c4-312a-43e0-9a53-ec56e42eb988` | Lying Leg Curl | Pernas | usuário | 2026-06-22 | — |
| apagar | `c4082a3a-e7a1-4c24-9fea-b08e217a3f63` | Lying Leg Curl | Pernas | usuário | 2026-06-22 | — |
| apagar | `a8ba99f8-63fd-4e98-b3fa-ad427515a6b0` | Lying Leg Curl | Pernas | usuário | 2026-06-22 | — |
| apagar | `cc5a135f-bbeb-47ad-8b10-8b63675e543e` | Lying Leg Curl | Pernas | usuário | 2026-06-22 | — |
| apagar | `9c090ec8-f739-4ad6-a05e-8bef379f0007` | Lying Leg Curl | Pernas | usuário | 2026-06-22 | — |
| apagar | `4fe91ed4-0f67-4d26-89aa-e13b3d113a80` | Lying Leg Curl | Pernas | usuário | 2026-06-22 | — |
| apagar | `499eb222-e4d3-45e4-ae3e-8b7719d49ae9` | Lying Leg Curl | Pernas | usuário | 2026-06-25 | — |
| apagar | `66b06180-ccc0-4727-8f74-2466ee8f4870` | Lying Leg Curl | Pernas | usuário | 2026-06-29 | — |
| apagar | `bd1d7567-4880-4fd5-8c45-20bf7ec62543` | Lying Leg Curl | Pernas | usuário | 2026-06-29 | — |
| apagar | `12cf50ee-d42e-4955-af99-acd70132b39d` | Lying Leg Curl | Pernas | usuário | 2026-06-29 | — |
| apagar | `5762600b-f933-4fa1-9ee9-34f89a458a9a` | Lying Leg Curl | Pernas | usuário | 2026-06-30 | — |

### Panturrilha em pé (13 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `3468d3d4-3280-4484-8570-9098167b7614` | Standing Calf Raise | Panturrilha | usuário | 2026-07-01 | 1 em user_workouts, 8 no histórico |
| ⚠️ remapear antes | `58a23e94-43d5-4b48-9bac-c149aaa83ec3` | Standing Calf Raise | Panturrilha | usuário | 2026-06-22 | 1 em user_workouts |
| apagar | `6dfefeb7-0556-4ce1-bcbf-e1fab855e0e5` | Standing Calf Raise | Panturrilha | usuário | 2026-06-11 | — |
| apagar | `f14f94be-7058-4062-8752-f18d015f5247` | Standing Calf Raise | Panturrilha | usuário | 2026-06-22 | — |
| apagar | `e6e731d8-795e-4949-9615-e4e5f5fc2404` | Standing Calf Raise | Panturrilha | usuário | 2026-06-22 | — |
| apagar | `71d04233-4758-4ff1-9914-ce4af1bb501c` | Standing Calf Raise | Panturrilha | usuário | 2026-06-22 | — |
| apagar | `ca611327-1b57-496d-b8c1-792e34f7dc31` | Standing Calf Raise | Panturrilha | usuário | 2026-06-22 | — |
| apagar | `b3c30e09-6154-43dc-b852-0fc5764f767c` | Standing Calf Raise | Panturrilha | usuário | 2026-06-22 | — |
| apagar | `3f5662a8-ca2d-4aee-afed-15ef9adf6210` | Standing Calf Raise | Panturrilha | usuário | 2026-06-25 | — |
| apagar | `de127fb2-f0f9-4e38-a2b8-ec0f1f887ca1` | Standing Calf Raise | Panturrilha | usuário | 2026-06-29 | — |
| apagar | `0616cb14-19ee-4846-ba58-0bf83e213209` | Standing Calf Raise | Panturrilha | usuário | 2026-06-29 | — |
| apagar | `0b42c356-ade6-438b-bdfa-ab89fc460ca8` | Standing Calf Raise | Panturrilha | usuário | 2026-06-29 | — |
| apagar | `975309a0-1742-4cf8-8314-b3624e61b7ae` | Standing Calf Raise | Panturrilha | usuário | 2026-06-30 | — |

### Puxada na frente (16 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `28b74618-e373-46fd-8174-550f71a843fd` | Lat Pulldown | Costas | usuário | 2026-07-01 | 1 em user_workouts, 6 no histórico |
| ⚠️ remapear antes | `404c21d9-9f45-40cb-802c-99b67e02e2aa` | Lat Pulldown | Costas | usuário | 2026-06-22 | 1 em user_workouts |
| ⚠️ remapear antes | `b5c77915-b7c2-4f5b-8883-1a3161bd81f9` | — | Costas | usuário | 2026-07-06 | 1 em user_workouts |
| apagar | `65b889ec-9577-4aeb-b249-ec17cc6bf504` | Front Lat Pulldown | Costas | catálogo | 2026-07-07 | — |
| apagar | `df8f5c03-4fc0-44de-ab21-9bf807e407dc` | Lat Pulldown | Costas | usuário | 2026-06-11 | — |
| apagar | `f7bb3416-9bcb-41ed-9ae3-de18da8a5bb6` | Lat Pulldown | Costas | usuário | 2026-06-18 | — |
| apagar | `1af97675-5a72-423d-bd55-de05dcbca54d` | Lat Pulldown | Costas | usuário | 2026-06-22 | — |
| apagar | `423ecb5a-df54-4e1f-94e3-1e0ae114b7c4` | Lat Pulldown | Costas | usuário | 2026-06-22 | — |
| apagar | `da728051-74ea-4ce7-95bf-ddba2f5adb8c` | Lat Pulldown | Costas | usuário | 2026-06-22 | — |
| apagar | `07baadc9-f750-4632-aa09-1da9a3dd5692` | Lat Pulldown | Costas | usuário | 2026-06-22 | — |
| apagar | `1966089d-8e7d-420f-bced-36529e163de5` | Lat Pulldown | Costas | usuário | 2026-06-22 | — |
| apagar | `934460ef-1b8b-408c-aa2c-69fca6583c3a` | Lat Pulldown | Costas | usuário | 2026-06-25 | — |
| apagar | `8da3c9b3-fc0b-42d8-a5c4-097f54b98698` | Lat Pulldown | Costas | usuário | 2026-06-29 | — |
| apagar | `0d54ce8a-5c10-4ece-ab0d-cbb5a3eb3032` | Lat Pulldown | Costas | usuário | 2026-06-29 | — |
| apagar | `881b389d-a4bb-47ad-9212-95e7558bd948` | Lat Pulldown | Costas | usuário | 2026-06-29 | — |
| apagar | `14f8d391-186d-4179-88fd-0b727e2ea9a3` | Lat Pulldown | Costas | usuário | 2026-06-30 | — |

### Puxada no Pulley Pegada Fechada (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `a0405664-517d-4ff6-99c0-d3cb61740828` | Close-Grip Cable Pulldown | Costas | catálogo | 2026-04-02 | — |
| apagar | `c709ac40-79c6-4116-b8f8-af2b67b4c7ec` | Close-Grip Cable Pulldown | Costas | catálogo | 2026-04-02 | — |

### Remada Alta com Halteres (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `648a013d-815f-4e07-92d7-1f6ad3aeb2bb` | Dumbbell Upright Row | Ombros | catálogo | 2026-04-02 | — |
| apagar | `32509c99-64cd-4ea6-8338-7beca1666256` | Dumbbell Upright Row | Braços | catálogo | 2026-04-02 | — |

### Remada Curvada com Halteres (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `e58da973-0a5e-43b6-917b-1c3048d5dbbc` | Bent-Over Dumbbell Row | Ombros | catálogo | 2026-04-02 | — |
| apagar | `f80cbf14-aa88-413c-9ad6-0017bf3476a2` | Bent-Over Dumbbell Row | Costas | catálogo | 2026-04-02 | — |

### Remada Curvada Pegada Supinada (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `d00d983e-d034-4670-b3d7-e5a0961b8f27` | Underhand Bent-Over Row | Costas | catálogo | 2026-04-02 | — |
| apagar | `6370216e-276f-4c22-9bd1-2c3be1d05a67` | Underhand Bent-Over Row | Costas | catálogo | 2026-04-02 | — |

### Remada na Máquina (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `f3963033-96d7-48cf-a885-63d36f4ab6d9` | Machine Row | Costas | catálogo | 2026-04-02 | — |
| apagar | `ce82419f-b155-4994-814d-219899f8b2a1` | Machine Row | Costas | catálogo | 2026-05-11 | — |

### Remada Sentada no Cabo (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `1fad69db-a97f-4d97-a421-ca6ef8af0580` | Seated Cable Row | Costas | catálogo | 2026-04-02 | — |
| apagar | `cb135fa8-16d4-4203-9a05-d94517feb3a1` | Seated Cable Row | Costas | catálogo | 2026-04-02 | — |

### Remada unilateral com halter (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `8a6d855a-6de9-422c-9f8a-8cd7b9c91d0e` | — | Costas | usuário | 2026-07-06 | 1 em user_workouts |
| apagar | `0a2686bf-135b-4791-9aff-1bc80263e62d` | One-Arm Dumbbell Row | Costas | catálogo | 2026-07-07 | — |

### Remada Unilateral no Cabo (3 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `250be4a2-4e87-45b8-8c5b-cd247ddb6c7f` | Single-Arm Cable Row | Costas | catálogo | 2026-04-02 | — |
| apagar | `7639231a-de34-4788-bcb7-02a28db4c52f` | Single-Arm Cable Row | Costas | catálogo | 2026-04-02 | — |
| apagar | `f345b141-40c1-40af-92c3-6bf2b6e9a316` | Single-Arm Cable Row | Costas | catálogo | 2026-04-02 | — |

### Rosca direta na barra (14 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `816a08e1-27ab-43d4-9e93-08d618dace83` | Barbell Curl | Bíceps | usuário | 2026-07-01 | 1 em user_workouts, 10 no histórico |
| ⚠️ remapear antes | `38eb7539-53e6-45ed-8cd2-e28d6743c655` | Barbell Curl | Bíceps | usuário | 2026-06-22 | 1 em user_workouts |
| apagar | `6c1ed447-1299-46b0-9331-76a3e680f7d0` | Barbell Curl | Bíceps | usuário | 2026-06-11 | — |
| apagar | `6a2d110b-b685-404c-a7de-b421df1020ea` | Barbell Curl | Bíceps | usuário | 2026-06-18 | — |
| apagar | `4c85f938-3321-44be-992c-fcac39304b36` | Barbell Curl | Bíceps | usuário | 2026-06-22 | — |
| apagar | `4e96c2bb-3780-4849-9c3d-d461b9d90edc` | Barbell Curl | Bíceps | usuário | 2026-06-22 | — |
| apagar | `b55a2bee-63af-471c-865e-07b94c8cb636` | Barbell Curl | Bíceps | usuário | 2026-06-22 | — |
| apagar | `1e00596b-f19f-4498-9532-0a7c6b04f0db` | Barbell Curl | Bíceps | usuário | 2026-06-22 | — |
| apagar | `ea949753-cc85-422d-8342-0a20feac8958` | Barbell Curl | Bíceps | usuário | 2026-06-22 | — |
| apagar | `85d7bf5f-df88-49a0-b753-35894a9326b9` | Barbell Curl | Bíceps | usuário | 2026-06-25 | — |
| apagar | `e03eb526-08a4-4cda-937b-d3e1288b6647` | Barbell Curl | Bíceps | usuário | 2026-06-29 | — |
| apagar | `82abc0c3-8d10-4e3c-b03f-2fc7e1327235` | Barbell Curl | Bíceps | usuário | 2026-06-29 | — |
| apagar | `9c48e28e-c689-44cc-b84d-b28c0698d32e` | Barbell Curl | Bíceps | usuário | 2026-06-29 | — |
| apagar | `6f3cb21c-1adf-478c-8239-561a6a5c1a12` | Barbell Curl | Bíceps | usuário | 2026-06-30 | — |

### Skull Crusher com Barra W (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `41e3a4ee-8450-409b-b0c6-387fb66c71ff` | EZ-Bar Skull Crusher | Braços | catálogo | 2026-04-02 | — |
| apagar | `909ef075-c57d-47c8-ab59-9bda3c04ce98` | EZ-Bar Skull Crusher | Braços | catálogo | 2026-04-02 | — |

### Supino com Halteres (3 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `8be04f23-0177-491f-890b-007119ee33d0` | Dumbbell Bench Press | Peito | catálogo | 2026-04-02 | — |
| apagar | `e90186d5-44f0-4772-bb37-d89b4985b807` | Dumbbell Bench Press | Peito | catálogo | 2026-04-02 | — |
| apagar | `5bc61af7-af96-4f0f-869d-14b8299d33f8` | Dumbbell Bench Press | Peito | catálogo | 2026-04-02 | — |

### Supino Inclinado com Halteres (5 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `2ef1b13e-d2ac-45da-8deb-d6fa28c8612d` | Dumbbell Incline Bench Press | Peito | catálogo | 2026-04-02 | 2 em user_workouts, 4 no histórico |
| apagar | `18aa0d1e-bd0c-4ba4-9734-6e280f7e2581` | Dumbbell Incline Bench Press | Peito | catálogo | 2026-04-02 | — |
| apagar | `da6f545e-45e5-4a76-a932-bbd8b7c27ab6` | Dumbbell Incline Bench Press | Peito | catálogo | 2026-04-02 | — |
| apagar | `0f0a238e-4b39-486e-9ac4-bbd94b934412` | Dumbbell Incline Bench Press | Peito | catálogo | 2026-04-02 | — |
| apagar | `548480da-0535-4ab9-875e-4df29879f4a6` | Dumbbell Incline Bench Press | Peito | usuário | 2026-06-09 | — |

### Supino na Máquina (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `46322816-e556-447d-89cd-fdfb6651503b` | Machine Chest Press | Peito | catálogo | 2026-04-02 | — |
| apagar | `870c6d96-aa77-4899-a144-f5228ac3882a` | Machine Chest Press | Peito | usuário | 2026-05-24 | — |

### Supino no Chão com Halteres (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `cd95483f-076c-4b11-8e6e-ecfdb7c0b9ee` | Dumbbell Floor Press | Braços | catálogo | 2026-04-02 | — |
| apagar | `25e62e7f-bff7-4ba4-a160-7713878e854d` | Dumbbell Floor Press | Peito | catálogo | 2026-04-02 | — |

### Supino Pegada Fechada (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `92603c82-a5da-4e8e-85a6-9869b05d3572` | Close-Grip Bench Press | Braços | catálogo | 2026-04-02 | — |
| apagar | `61c30d63-bb0f-451e-b012-31d05241846f` | Close-Grip Bench Press | Peito | catálogo | 2026-04-02 | — |

### Supino Reto (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `270c87e6-6eda-485f-8ccf-454285d8a449` | Flat Bench Press | Peito | catálogo | 2026-04-02 | 2 em user_workouts, 11 no histórico |
| apagar | `e612c95f-078f-4604-904b-6a5f3a77d721` | Flat Bench Press | Peito | usuário | 2026-06-09 | — |

### Tríceps francês (2 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `f1b6b434-16c6-420d-a56c-4c343746ebf9` | — | Tríceps | usuário | 2026-07-06 | 1 em user_workouts |
| apagar | `1908a020-c91c-42a2-a33a-53158ea4ed0e` | Overhead Triceps Extension | Braços | catálogo | 2026-07-07 | — |

### Tríceps na polia (16 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `042ef1df-6af7-473e-9323-c31a9e5d9748` | Triceps Pushdown | Tríceps | usuário | 2026-07-01 | 1 em user_workouts, 8 no histórico |
| ⚠️ remapear antes | `65bfcdd6-8594-4c48-b43b-f6f784215208` | Triceps Pushdown | Tríceps | usuário | 2026-06-11 | 1 em user_workouts |
| ⚠️ remapear antes | `7cf2cedf-2177-426d-959e-37c22f3c9a06` | — | Tríceps | usuário | 2026-07-06 | 1 em user_workouts |
| apagar | `f9760b1e-89d6-4762-b3ad-ea145b2632c9` | Triceps Pushdown | Tríceps | usuário | 2026-06-09 | — |
| apagar | `156d327c-8ea8-4881-a305-73e3d8461279` | Triceps Pushdown | Tríceps | usuário | 2026-06-18 | — |
| apagar | `0cf55c8c-cce8-4515-8c59-72eb2a9b56fd` | Triceps Pushdown | Tríceps | usuário | 2026-06-22 | — |
| apagar | `1ef4db0a-ceaa-4f2b-96b7-7a13fe1df64e` | Triceps Pushdown | Tríceps | usuário | 2026-06-22 | — |
| apagar | `dfe4c318-6e10-49c1-8963-f08eb8f8c6f9` | Triceps Pushdown | Tríceps | usuário | 2026-06-22 | — |
| apagar | `ee4b0f83-6b7f-46c9-9b32-300543efda26` | Triceps Pushdown | Tríceps | usuário | 2026-06-22 | — |
| apagar | `8cc94d37-ac12-4665-b29d-b2990fb265fe` | Triceps Pushdown | Tríceps | usuário | 2026-06-22 | — |
| apagar | `0320dd2c-244e-4fc9-8b47-7dc6e39cb031` | Triceps Pushdown | Tríceps | usuário | 2026-06-22 | — |
| apagar | `08d4cc72-571c-45b6-820c-31df46f9b822` | Triceps Pushdown | Tríceps | usuário | 2026-06-25 | — |
| apagar | `f5f8d249-196f-4e4e-a438-b863f597a6ac` | Triceps Pushdown | Tríceps | usuário | 2026-06-29 | — |
| apagar | `37178867-0b62-402a-8216-a16a6da8a47f` | Triceps Pushdown | Tríceps | usuário | 2026-06-29 | — |
| apagar | `3c091622-ec9d-456f-bc3c-a626254e3502` | Triceps Pushdown | Tríceps | usuário | 2026-06-29 | — |
| apagar | `0fed391f-a8a8-4368-9128-437c0f26404d` | Triceps Pushdown | Tríceps | usuário | 2026-06-30 | — |

### Tríceps testa (16 registros)

| Ação | ID | eng | Grupo | Origem | Criado | Referências |
|---|---|---|---|---|---|---|
| **MANTER** | `759da34f-9f23-462a-a0e8-3ff699084054` | Skull Crusher | Tríceps | usuário | 2026-07-01 | 1 em user_workouts, 6 no histórico |
| apagar | `ef812c7d-e535-4877-b8dd-5b365cbd1739` | Skull Crusher | Braços | catálogo | 2026-07-07 | — |
| apagar | `874d38d3-b2e2-45c5-86d1-e98e381151ef` | Skull Crusher | Tríceps | usuário | 2026-06-09 | — |
| apagar | `ed377219-0349-41c8-8bef-93849781ded3` | Skull Crusher | Tríceps | usuário | 2026-06-11 | — |
| apagar | `15b10c3d-a846-4939-8909-007e6b3f60f4` | Skull Crusher | Tríceps | usuário | 2026-06-18 | — |
| apagar | `3c4364a1-9e02-4c5b-af64-345e4148b25d` | Skull Crusher | Tríceps | usuário | 2026-06-22 | — |
| apagar | `2c5eb168-2c4c-4bfa-af3b-dcfe899b78cd` | Skull Crusher | Tríceps | usuário | 2026-06-22 | — |
| apagar | `c0e570b8-26d3-4591-84f6-1bb0161b2b90` | Skull Crusher | Tríceps | usuário | 2026-06-22 | — |
| apagar | `1e4ad349-8b9a-46ba-9c33-29c8d66f05ea` | Skull Crusher | Tríceps | usuário | 2026-06-22 | — |
| apagar | `dfef067f-5d3d-4711-b999-1add40dd2597` | Skull Crusher | Tríceps | usuário | 2026-06-22 | — |
| apagar | `b7fa6183-6db7-4144-9cc3-72f2c026b85a` | Skull Crusher | Tríceps | usuário | 2026-06-22 | — |
| apagar | `91857f2c-2d93-434f-adbb-12ac464bf7ec` | Skull Crusher | Tríceps | usuário | 2026-06-25 | — |
| apagar | `6c1bb6aa-647f-41fa-95c6-53154f2f5f12` | Skull Crusher | Tríceps | usuário | 2026-06-29 | — |
| apagar | `6654749b-0074-4c2c-9ad1-06a49a0bf411` | Skull Crusher | Tríceps | usuário | 2026-06-29 | — |
| apagar | `f4f00c39-fbfb-4765-86cb-776814a6017a` | Skull Crusher | Tríceps | usuário | 2026-06-29 | — |
| apagar | `44a01622-6ab0-4e4f-875b-36f76cc4a6d9` | Skull Crusher | Tríceps | usuário | 2026-06-30 | — |

## 2. Possíveis duplicados (mesmo nome EN, nome PT diferente) — revisar manualmente

Aqui só listo os nomes PT distintos de cada grupo (os IDs repetidos já aparecem na seção 1).

### eng: "Cable Crossover"

- "Crossover" — 15 registro(s), 1 referência(s) de usuário
- "Crossover no Cabo" — 1 registro(s), 0 referência(s) de usuário — `7f1fb2ba-6b7e-462e-8bc3-86895d8fcddc`

### eng: "Cable Fly"

- "Crucifixo na polia" — 1 registro(s), 0 referência(s) de usuário — `df18f8b7-48cf-46b8-b104-3fc5ea5cf5ee`
- "Crucifixo no Cabo" — 1 registro(s), 0 referência(s) de usuário — `0a7a8b7c-9ddf-4894-9eae-01545518970c`

### eng: "Cable Hammer Curl"

- "Rosca martelo na polia" — 1 registro(s), 0 referência(s) de usuário — `19f54f64-c34d-466f-830a-4a70dbe7906a`
- "Rosca Martelo no Cabo" — 1 registro(s), 0 referência(s) de usuário — `b258d2df-b823-4327-8608-7b58168f89d5`

### eng: "Dumbbell Shoulder Press"

- "Desenvolvimento com Halter" — 1 registro(s), 0 referência(s) de usuário — `f82d838c-9dd8-4f35-9b63-6650e5509e22`
- "Desenvolvimento com Halteres" — 1 registro(s), 0 referência(s) de usuário — `6f80fa5e-a01a-4fea-a610-4ca454c3d896`

### eng: "Lying Leg Curl"

- "Flexão de Joelho Deitado (Leg Curl)" — 1 registro(s), 3 referência(s) de usuário — `3e343903-39c1-436c-9268-48a68859b78a`
- "Mesa flexora" — 14 registro(s), 1 referência(s) de usuário

### eng: "Overhead Triceps Extension"

- "Extensão de Tríceps acima da cabeça" — 2 registro(s), 0 referência(s) de usuário
- "Tríceps francês" — 1 registro(s), 0 referência(s) de usuário — `1908a020-c91c-42a2-a33a-53158ea4ed0e`

### eng: "Pull-up"

- "Barra fixa" — 14 registro(s), 13 referência(s) de usuário
- "Flexões de Braço (Pull-up)" — 1 registro(s), 0 referência(s) de usuário — `7c9037cb-be5a-4f26-9137-bf81cd99ad81`

### eng: "Standing Calf Raise"

- "Elevação de Panturrilha em Pé" — 1 registro(s), 0 referência(s) de usuário — `c4e368fb-0ba9-4466-9f78-42873c58c948`
- "Panturrilha em pé" — 13 registro(s), 10 referência(s) de usuário

### eng: "Standing Leg Curl"

- "Flexão de Joelho em Pé (Leg Curl)" — 1 registro(s), 3 referência(s) de usuário — `3d8fd301-23e1-4082-a360-0909ccff9ac8`
- "Flexão de Pernas em Pé" — 1 registro(s), 0 referência(s) de usuário — `13fd322c-7b38-45cc-98ac-4303c9f72b7f`

### eng: "Triceps Pushdown"

- "Tríceps na polia" — 15 registro(s), 10 referência(s) de usuário
- "Tríceps Pulley" — 1 registro(s), 0 referência(s) de usuário — `d20b9f53-f57a-4a2d-a05c-42d63d7847a4`

## 3. Resumo

- Grupos de duplicados exatos: **39**
- Registros excedentes (total a apagar se mantiver 1 por grupo): **176**
- Desses, **167** não têm nenhuma referência de usuário → podem ser apagados direto
- Os outros **9** têm referências e precisam de remapeamento de `workout_id` antes

### IDs sem referência, seguros para apagar (após sua conferência)

```
19aa2df7-344e-46ce-8e68-cbebda04a188
6b324ca9-d699-4f5a-89c2-57aec5cee6af
077b059d-0102-436a-896e-b81e1bd99bce
c6babd1d-e3ac-485a-92ee-fdf3549c2b73
4b17616c-30c1-4a5e-89b9-703908c54eae
23f55f6d-5c31-4689-9468-49ad7c32b249
0735a115-26b8-4106-8863-10b93f344712
28437484-a0ed-4c71-b29f-8caae4dd0624
42189604-1488-4ec0-bd4e-3c46c90c1e1f
7732f123-2cf6-4627-b8d2-9d7a7e013e16
148506da-7291-4dd5-a196-64aaf852e0aa
51cc7384-3f84-4007-897b-ec5b2e787250
cf4622e1-aa1d-4ab8-b7f4-e9c5859884d0
4185412e-39a4-47a1-9acd-6cb9f4f8800c
54c052f4-633d-4a21-af94-555d5a69c9fa
6b9aa09c-fcba-45ff-b57c-12c3fede10ee
e0f42744-6dcd-45c6-8cb6-185eb6d053ee
3d1a5246-b544-4217-a51f-46152af7465e
c68713e0-a306-402a-acf5-d145e9cd3cb9
e218b332-d448-4dd2-a366-57e9d9f03486
bb35b82a-778f-4fdd-b834-f944113a830a
553e9f7b-2b56-48d1-8279-748eadb15ae6
846771f9-05a6-4575-a54a-44310b3dfa93
02f92e3d-4ea2-45fe-87a6-aa87bb7d1abd
42a26e60-331d-4fa6-948d-148b202e5c44
beeca397-2df4-4d09-994e-db7e1662f662
915d1398-4d1a-4a1d-8e5c-4f8718e4dddc
58bef78d-53f1-4bb3-bb35-50ea1d9b3b25
d83455cc-8e94-49ff-8d25-fff502e5dd8a
54aa5a99-4acd-477a-a9ba-cdc1d5013e2d
a1493547-1582-4068-aa39-ddee27e2c18a
da11f402-faa4-4432-9773-a3dc4ed853ea
fc874a4e-84db-4195-a9d9-99156ad67a19
8cdaacab-d958-49a8-aeb1-401822ee7c7a
a2a642c2-d529-4418-ab8c-1d73c95d8c36
c1b2a612-d854-4f79-a8fd-3e499c0a617b
73a385a9-e271-418b-aed2-c3aba0cb4bfd
b1d255f1-a8e3-4390-a054-efb84b30773f
8df4738c-9e38-4f82-a806-7adfab8ef101
4535c2e1-0d52-42de-8e02-90cd4e0df234
b0054f6e-8097-46b9-a802-bfa8235b5826
e59eeabb-55c2-4e0f-b6d8-f638cdc2bc6c
08d21c81-d646-44c5-9e53-de98d64450a4
333329a3-3175-4221-8d1d-e82e917ab608
bb606bdb-4dea-4570-be37-755ff1131f48
c1d3abaa-8ed9-4fd3-84ba-b5caf83ea2d6
78070d3d-9afc-415e-86a3-0c033cf2727b
cb6a35f1-6719-412e-bd71-93b4e003cf2b
611c6745-d954-466f-91a7-3cb638f47080
8b289457-9730-45c3-9a86-ec43d599b5ac
7c494eec-1ddd-4fa0-9316-25e9e5136b93
16afd307-7e92-4ad8-8aa1-59108df4b4cf
7d5b221f-66d4-4f4f-92cc-f5db812e9e5a
098433c7-f46b-4e93-8f9c-ad05e3fbaca2
54998ffe-d4e6-4ab8-a46f-b2fa90682e65
a9b58886-04ad-40fe-a078-b48088e56f8e
178774d5-b51f-43c9-9faf-5bc423a46503
acfdfa11-9b9c-4616-849f-dfb70f79cf37
c6107772-a9ed-4fba-a8e9-259019fb2855
1b50f330-3244-43f2-8da4-69759b8fc27f
927c9236-920c-40b4-b181-bbf7ae4d64a1
e1fd3066-0e40-480e-b977-73e2792ea771
a3be0fc5-d04e-4de8-99ca-2007397ccc0c
cf2dffe1-f6c0-454e-ac66-8e14771909da
bcccdb35-cc99-4d03-9595-3150aecdbde0
2a248edc-26c6-4f6b-8a8a-7ae36185294a
a12bb9f1-2fc0-4d34-9d14-cef0582ac2ae
1aa9b051-a283-46f4-b2f8-3ff60cd0b5f8
1c7ee82f-5e57-4fee-a543-a5101cbd446e
489f43a0-e3ea-4ade-8ae0-af97f4808c05
8c992f56-a35a-4db8-b984-0465d2231b93
6600f9c4-312a-43e0-9a53-ec56e42eb988
c4082a3a-e7a1-4c24-9fea-b08e217a3f63
a8ba99f8-63fd-4e98-b3fa-ad427515a6b0
cc5a135f-bbeb-47ad-8b10-8b63675e543e
9c090ec8-f739-4ad6-a05e-8bef379f0007
4fe91ed4-0f67-4d26-89aa-e13b3d113a80
499eb222-e4d3-45e4-ae3e-8b7719d49ae9
66b06180-ccc0-4727-8f74-2466ee8f4870
bd1d7567-4880-4fd5-8c45-20bf7ec62543
12cf50ee-d42e-4955-af99-acd70132b39d
5762600b-f933-4fa1-9ee9-34f89a458a9a
6dfefeb7-0556-4ce1-bcbf-e1fab855e0e5
f14f94be-7058-4062-8752-f18d015f5247
e6e731d8-795e-4949-9615-e4e5f5fc2404
71d04233-4758-4ff1-9914-ce4af1bb501c
ca611327-1b57-496d-b8c1-792e34f7dc31
b3c30e09-6154-43dc-b852-0fc5764f767c
3f5662a8-ca2d-4aee-afed-15ef9adf6210
de127fb2-f0f9-4e38-a2b8-ec0f1f887ca1
0616cb14-19ee-4846-ba58-0bf83e213209
0b42c356-ade6-438b-bdfa-ab89fc460ca8
975309a0-1742-4cf8-8314-b3624e61b7ae
65b889ec-9577-4aeb-b249-ec17cc6bf504
df8f5c03-4fc0-44de-ab21-9bf807e407dc
f7bb3416-9bcb-41ed-9ae3-de18da8a5bb6
1af97675-5a72-423d-bd55-de05dcbca54d
423ecb5a-df54-4e1f-94e3-1e0ae114b7c4
da728051-74ea-4ce7-95bf-ddba2f5adb8c
07baadc9-f750-4632-aa09-1da9a3dd5692
1966089d-8e7d-420f-bced-36529e163de5
934460ef-1b8b-408c-aa2c-69fca6583c3a
8da3c9b3-fc0b-42d8-a5c4-097f54b98698
0d54ce8a-5c10-4ece-ab0d-cbb5a3eb3032
881b389d-a4bb-47ad-9212-95e7558bd948
14f8d391-186d-4179-88fd-0b727e2ea9a3
c709ac40-79c6-4116-b8f8-af2b67b4c7ec
32509c99-64cd-4ea6-8338-7beca1666256
f80cbf14-aa88-413c-9ad6-0017bf3476a2
6370216e-276f-4c22-9bd1-2c3be1d05a67
ce82419f-b155-4994-814d-219899f8b2a1
cb135fa8-16d4-4203-9a05-d94517feb3a1
0a2686bf-135b-4791-9aff-1bc80263e62d
7639231a-de34-4788-bcb7-02a28db4c52f
f345b141-40c1-40af-92c3-6bf2b6e9a316
6c1ed447-1299-46b0-9331-76a3e680f7d0
6a2d110b-b685-404c-a7de-b421df1020ea
4c85f938-3321-44be-992c-fcac39304b36
4e96c2bb-3780-4849-9c3d-d461b9d90edc
b55a2bee-63af-471c-865e-07b94c8cb636
1e00596b-f19f-4498-9532-0a7c6b04f0db
ea949753-cc85-422d-8342-0a20feac8958
85d7bf5f-df88-49a0-b753-35894a9326b9
e03eb526-08a4-4cda-937b-d3e1288b6647
82abc0c3-8d10-4e3c-b03f-2fc7e1327235
9c48e28e-c689-44cc-b84d-b28c0698d32e
6f3cb21c-1adf-478c-8239-561a6a5c1a12
909ef075-c57d-47c8-ab59-9bda3c04ce98
e90186d5-44f0-4772-bb37-d89b4985b807
5bc61af7-af96-4f0f-869d-14b8299d33f8
18aa0d1e-bd0c-4ba4-9734-6e280f7e2581
da6f545e-45e5-4a76-a932-bbd8b7c27ab6
0f0a238e-4b39-486e-9ac4-bbd94b934412
548480da-0535-4ab9-875e-4df29879f4a6
870c6d96-aa77-4899-a144-f5228ac3882a
25e62e7f-bff7-4ba4-a160-7713878e854d
61c30d63-bb0f-451e-b012-31d05241846f
e612c95f-078f-4604-904b-6a5f3a77d721
1908a020-c91c-42a2-a33a-53158ea4ed0e
f9760b1e-89d6-4762-b3ad-ea145b2632c9
156d327c-8ea8-4881-a305-73e3d8461279
0cf55c8c-cce8-4515-8c59-72eb2a9b56fd
1ef4db0a-ceaa-4f2b-96b7-7a13fe1df64e
dfe4c318-6e10-49c1-8963-f08eb8f8c6f9
ee4b0f83-6b7f-46c9-9b32-300543efda26
8cc94d37-ac12-4665-b29d-b2990fb265fe
0320dd2c-244e-4fc9-8b47-7dc6e39cb031
08d4cc72-571c-45b6-820c-31df46f9b822
f5f8d249-196f-4e4e-a438-b863f597a6ac
37178867-0b62-402a-8216-a16a6da8a47f
3c091622-ec9d-456f-bc3c-a626254e3502
0fed391f-a8a8-4368-9128-437c0f26404d
ef812c7d-e535-4877-b8dd-5b365cbd1739
874d38d3-b2e2-45c5-86d1-e98e381151ef
ed377219-0349-41c8-8bef-93849781ded3
15b10c3d-a846-4939-8909-007e6b3f60f4
3c4364a1-9e02-4c5b-af64-345e4148b25d
2c5eb168-2c4c-4bfa-af3b-dcfe899b78cd
c0e570b8-26d3-4591-84f6-1bb0161b2b90
1e4ad349-8b9a-46ba-9c33-29c8d66f05ea
dfef067f-5d3d-4711-b999-1add40dd2597
b7fa6183-6db7-4144-9cc3-72f2c026b85a
91857f2c-2d93-434f-adbb-12ac464bf7ec
6c1bb6aa-647f-41fa-95c6-53154f2f5f12
6654749b-0074-4c2c-9ad1-06a49a0bf411
f4f00c39-fbfb-4765-86cb-776814a6017a
44a01622-6ab0-4e4f-875b-36f76cc4a6d9
```
