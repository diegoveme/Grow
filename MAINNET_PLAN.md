# Plan para llevar Grow a mainnet

Fecha límite: **2026-11-27, 12:00**. Meta: deploy listo a las 9:00 para tener 3 horas de margen.

El plan sigue los tres gates del skill `deploy-stellar-mainnet` del Stellar-Build toolkit: verificación previa, mecánica del deploy y post-deploy. No se salta ningún punto del Gate 1.

---

## 1. Lo que ya pasa (Gate 1, verificado el 2026-11-26, actualizado tras la revisión)

| Punto | Estado |
|---|---|
| Tests | ✅ 74 del contrato + 4 sobre el wasm real (upgrade y presupuesto de un lote de 10), 43 unitarios y 5 e2e de la API |
| Regresión en la nube | ✅ 26/26 en testnet contra la API desplegada en Railway, con transacciones reales y el keeper ejecutando una remesa recurrente (`apps/api/scripts/testnet-regression.ts`) |
| Prueba de punta a punta | ✅ txs reales en el contrato de testnet `CBEQUA2ET4XTZAMDB3ZOB6MUOA2B6ACZ6TV2GCDHFTETKBVG7TMBZCYA`, regresión 28/28 |
| `unwrap` / `expect` / `panic!` | ✅ ninguno fuera de los tests; los errores son tipados (`panic_with_error!`) |
| Overflow | ✅ `overflow-checks = true` en el perfil release: si algo desborda, la tx falla en vez de dar un número equivocado |
| Auth | ✅ cada función de usuario pide `require_auth`. `run_schedule` no la pide a propósito: solo mueve lo que el remitente ya aprobó y al destinatario fijado |
| Funciones de admin | ✅ `set_user_cap`, `set_paused`, `recover_token` y `upgrade` exigen la firma del admin |
| Pausa | ✅ existe; retirar ahorro, pagar desde el ahorro y liberar o devolver apartados nunca se pausan, así nadie queda atrapado |
| `recover_token` | ✅ rechaza el USDC configurado, así no puede tocar el ahorro de nadie |
| Llamadas a otros contratos | ✅ el contrato llama al SAC de USDC; `recover_token` (solo admin) llama al token que se le indique, nunca al USDC; DeFindex se llama desde la wallet del usuario |
| TTL | ✅ la instancia se extiende a 30 días y los datos de cada usuario a 120; los apartados duran máximo 100 días y los intervalos de las recurrentes máximo 92, dentro de ese TTL |
| Tope por persona | ✅ el ahorro sobre el tope va a la wallet (nunca bloquea una remesa ni un lote) y los apartados abiertos por beneficiario comparten el tope |
| USDC mainnet | ✅ el SAC de `USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` es `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` (calculado con el CLI, coincide con los docs de DeFindex) |
| CLI y toolchain | ✅ `stellar` 30.0.1 y target `wasm32v1-none`; el wasm pesa 21.6 KB |
| Constructor | ✅ `__constructor(admin, token, user_cap)` corre en el mismo deploy, no hay `initialize` aparte que alguien pueda adelantar |

---

## 2. Lo que falta (bloqueantes)

1. **Revisión de pares.** El skill no deja pasar sin evidencia de revisión, porque el contrato guarda dinero de usuarios.
   - ✅ `stellar-code-review` sobre el contrato (3 capas). Todo lo que tocaba fondos quedó corregido y con tests.
   - ⏳ Que un compañero del equipo lo apruebe en un PR o issue.
   - ✅ Aceptación de riesgo escrita en `docs/security.md`.
2. ✅ **Guarda de red en la config.** La API no arranca y el build de la web falla si se mezclan redes; en mainnet el RPC y el contrato son obligatorios.
3. ⏳ **RPC de mainnet.** SDF no ofrece RPC pública para mainnet; el CLI tiene `mainnet` como "Bring Your Own". Hay que elegir proveedor.
4. ⏳ **Postgres en mainnet** (Supabase, a cargo de la amiga de Diego). El indexador de `/stats` lee eventos con `getEvents`, y los proveedores solo guardan unos días de eventos. Sin base de datos, un reinicio de la API pierde historial, y para SCF hace falta la métrica on-chain completa.
5. ✅ **Docs del deploy.** `docs/mainnet.md` tiene el runbook y la bitácora; falta llenarla al desplegar y poner el contract ID en el README.
6. ✅ **Banner de beta en mainnet**, en español e inglés, con el tope por persona.

---

## 3. Lo que tiene que conseguir Diego (camino crítico, empezar ya)

1. **XLM en mainnet**: unos 60 XLM en total, comprados en un exchange. Los retiros pueden tardar, por eso va primero.
   - ~25 XLM para la cuenta admin (subir y desplegar cuesta pocos XLM; el resto es margen).
   - ~15 XLM para el keeper (paga las comisiones de las remesas recurrentes).
   - ~10 XLM para la wallet de pruebas.
2. **USDC real**: unos 10 USDC en la wallet de pruebas para probar desde la app.
3. **Proveedor de RPC de mainnet.** La lista oficial de Stellar incluye Gateway.fm, Nodies, OnFinality, Lightsail, Ankr y Liquify; Validation Cloud y Chainstack tienen plan gratis. Hay que confirmar que `getEvents` funciona.
4. **Supabase** (o cualquier Postgres).
5. **Hosting:** un proyecto nuevo en cada uno, para que el de testnet siga como demo.

| Parte | Qué necesita | Dónde |
|---|---|---|
| Web (Next.js) | Hosting estático, porque se exporta como HTML/JS (`output: "export"`) | Vercel |
| API (NestJS) | Servidor Node 22.12+ siempre encendido, porque el keeper corre cada 60 s y el indexador de `/stats` no para | Railway (`railway.json` ya está en el repo) |

Las funciones serverless de Vercel y los planes gratis que "duermen" el servidor no sirven para la API. En Railway hay que revisar que el plan permita tenerla encendida 24/7.

---

## 4. Decisiones (con recomendación)

| Decisión | Recomendación |
|---|---|
| Límite de ahorro por persona (`user_cap`) | 100 USDC para la beta (`1000000000` con 7 decimales) |
| Llave admin | Cuenta clásica dedicada (`grow-mainnet-admin`). El contrato no tiene función para cambiar de admin, pero a una cuenta clásica se le pueden agregar firmantes después (multisig 2 de 3) sin tocar el contrato. Si hay un Ledger, mejor todavía |
| Vault en mainnet | Arrancar en "vista previa" salvo que se verifique on-chain antes del deploy (ver abajo) |
| Hosting | Seguir con Railway y Vercel; cambiar de proveedor a horas del deadline es riesgo sin ganancia |

**Verificación del vault de DeFindex en mainnet:**

- Los docs de DeFindex publican la estrategia USDC de Blend `CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP`.
- No hay una dirección oficial del vault. Dos proyectos publican vaults distintos (`CDODNWQY54F4WS7AZ5Z3AAIWRLKBFUMXHNOFEM4H3UNCTMFK4RF2A6GU` y otro que empieza con `CAJ2L33Q…`), y no coinciden entre sí.
- Para activarlo hay que confirmar tres cosas:
  1. Su activo es `CCW67…`.
  2. Su estrategia es la de arriba.
  3. Un depósito y retiro de 1 USDC funciona.
- Si no, sin `DEFINDEX_VAULT_ADDRESS` la app ya muestra "El vault está en vista previa".

---

## 5. Cronograma

### Hoy

- **Diego:**
  - Comprar XLM y USDC.
  - Crear las cuentas del RPC, Supabase, Vercel y Railway.
  - Pedir la revisión del contrato.
- **Desarrollo:**
  - `stellar-code-review` del contrato.
  - Guarda de red en API y web, y banner de beta.
  - `docs/mainnet.md` y la aceptación de riesgo en `docs/security.md`.
  - Regresión final en testnet con el wasm exacto que va a mainnet.
  - Commits locales; push solo con el visto bueno de Diego.

### Mañana, 7:00 a 9:00

- Generar las llaves; Diego las fondea desde el exchange.
- Subir y desplegar el contrato, y verificar `config`.
- Configurar Railway y Vercel con las variables de la sección 7.
- Probar desde la app con 1 USDC:
  - Elegir el reparto.
  - Enviar a una segunda wallet.
  - Retirar ahorro.
  - Apartar un pago y recuperarlo.
  - Hacer el pago con memo `SHIP-S97KF8`.

### Mañana, 9:00 a 12:00

- Monitor de uptime sobre `/api/health`.
- Confirmar `/stats` en vivo con el contrato de mainnet.
- README con el contract ID y el link a StellarView.
- Vault solo si quedó verificado.
- El resto es margen.

---

## 6. Comandos del deploy

```bash
# Red de mainnet con el proveedor elegido
stellar network add grow-mainnet --rpc-url <URL_DEL_PROVEEDOR> \
  --network-passphrase "Public Global Stellar Network ; September 2015"

# Llaves: quedan en el llavero local, nunca en el repo ni en CI
stellar keys generate grow-mainnet-admin
stellar keys generate grow-mainnet-keeper
stellar keys address grow-mainnet-admin     # a esta dirección se manda el XLM

# Build del commit exacto que se despliega (anotar el hash)
cd packages/contracts && stellar contract build
sha256sum target/wasm32v1-none/release/yield_splitter.wasm

# Subir el wasm (devuelve el hash)
stellar contract upload --network grow-mainnet --source grow-mainnet-admin \
  --wasm target/wasm32v1-none/release/yield_splitter.wasm

# Desplegar; el constructor corre en este mismo paso
stellar contract deploy --network grow-mainnet --source grow-mainnet-admin --wasm-hash <HASH> -- \
  --admin <G_ADMIN> \
  --token CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75 \
  --user_cap 1000000000

# Verificar el estado
stellar contract invoke --network grow-mainnet --source grow-mainnet-admin --id <CONTRACT_ID> -- config
```

La passphrase de mainnet es `Public Global Stellar Network ; September 2015`. La de testnet empieza con `Test SDF Network`; nunca copiarla de la config de testnet.

---

## 7. Variables de entorno

### Railway (API)

| Variable | Valor |
|---|---|
| `STELLAR_NETWORK` | `PUBLIC` |
| `SOROBAN_RPC_URL` | URL del proveedor de RPC |
| `HORIZON_URL` | `https://horizon.stellar.org` |
| `YIELD_SPLITTER_CONTRACT_ID` | el contract ID del deploy |
| `USDC_TOKEN_ID` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| `USDC_ISSUER` | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| `CORS_ORIGIN` | la URL de Vercel de mainnet |
| `KEEPER_SECRET` | secreto de `grow-mainnet-keeper` (solo en Railway, nunca en el repo) |
| `STATS_START_LEDGER` | el ledger del deploy |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | datos de Supabase |
| `DEFINDEX_VAULT_ADDRESS`, `BLEND_POOL_ID` | vacías, salvo que el vault quede verificado |

### Vercel (web)

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `PUBLIC` |
| `NEXT_PUBLIC_API_URL` | la URL de Railway de mainnet |
| `NEXT_PUBLIC_USDC_TOKEN_ID` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

---

## 8. Después del deploy (Gate 3)

- [ ] El contrato responde a `config` en mainnet y coincide con lo esperado.
- [ ] Prueba de humo desde la app hecha con montos pequeños.
- [ ] Contract ID, hash del wasm, commit, ledger y llave pública del admin anotados en `docs/mainnet.md` y en el README.
- [ ] Contrato revisado en StellarView y en `stellar.expert/explorer/public/contract/<CONTRACT_ID>`.
- [ ] Monitor de uptime sobre `/api/health`.
- [ ] `/stats` mostrando volumen y ahorro del contrato de mainnet.
- [ ] Anuncio en X con el contract ID y el link del explorer.

---

## 9. Fuera de este deploy (después del deadline)

- Anchor real en mainnet (el panel ya muestra "pronto").
- Passkeys con comisiones patrocinadas.
- Trustless Work para remesas condicionadas.
- Timelock para `upgrade`.
- Alertas cuando el contrato emita eventos de pausa, upgrade o recuperación de tokens.
- Revisar qué pasa con los datos de un usuario inactivo más de 120 días (archivado y restauración).
- Listado en LumenLoop y en `lumenloop/stellar-ecosystem-db`.

---

## Fuentes

- [Stellar Docs: RPC providers](https://developers.stellar.org/docs/data/apis/rpc/providers)
- [Gateway.fm en SCF (plan gratis)](https://communityfund.stellar.org/project/gatewayfm-noq)
- [Chainstack: proveedores RPC de Stellar](https://chainstack.com/learn/compare/top-6-stellar-rpc-providers-for-payments/)
- [DeFindex: crear un vault (USDC en mainnet)](https://docs.defindex.io/integration-guide/creating-a-defindex-vault/index)
- [DeFindex stellar-contracts](https://github.com/defindex-io/stellar-contracts)
- [Writz PR #183](https://github.com/WritzProtocol/writz/pull/183)
- [LoopDevs PR #111](https://github.com/LoopDevs/loop-app/pull/111)
- [ZephyRoute issue #1](https://github.com/ZephyRoute/zephyroute/issues/1)
