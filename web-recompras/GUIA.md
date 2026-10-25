# Cómo publicar la web de Recompras (sin saber programar)

Son **5 pasos de hacer clic**, unos 20 minutos en total. No hay que escribir código ni copiar archivos.

Si en algún paso la pantalla no se parece a lo que dice acá, **sacale una captura y mandásela a Claude**. Las páginas cambian el nombre de algún botón cada tanto, y con la captura te dice dónde tocar.

---

## Paso 1: crear tu cuenta en Vercel (gratis)

Vercel es el servicio que publica la web en internet.

1. Entrá a **vercel.com**.
2. Tocá **Sign Up**.
3. Elegí **Hobby** (es el plan gratis).
4. Escribí tu nombre y tocá **Continue with GitHub**.
5. Si GitHub te pide permiso, tocá **Authorize**.

✅ Listo cuando ves la pantalla principal de Vercel (dice "Overview" o "Let's build something").

## Paso 2: publicar la web

1. Arriba a la derecha tocá **Add New…** y después **Project**.
2. En la lista aparece **Mercadodigital**. Tocá **Import** al lado.
   - Si no aparece: tocá **Adjust GitHub App Permissions**, elegí el repositorio **Mercadodigital**, tocá **Save** y volvé.
3. Buscá **Root Directory** y tocá **Edit**. Elegí la carpeta **web-recompras** y tocá **Continue**.
4. Tocá el botón azul **Deploy**.
5. Esperá 1 o 2 minutos hasta que aparezca **Congratulations** con confeti.

✅ La web ya está publicada, pero todavía no tiene base de datos. Eso es el paso 3.

## Paso 3: crear la base de datos (gratis)

1. Tocá **Continue to Dashboard** (o entrá a tu proyecto).
2. Arriba, tocá la pestaña **Storage**.
3. Tocá **Create Database** (o **Create**), elegí **Supabase** y tocá **Continue**.
4. Aceptá las condiciones si te las pide.
5. Nombre: `recompras`. Región: **São Paulo** (la más cercana a Paraguay). Plan: **Free**. Tocá **Create**.
6. Si te pregunta a qué proyecto conectarla, elegí el de la web y tocá **Connect**.
7. Ahora hay que volver a publicar para que la web vea la base:
   - Arriba, pestaña **Deployments**.
   - En la primera fila, tocá los **tres puntitos (⋯)** de la derecha y elegí **Redeploy**. Confirmá con **Redeploy**.
   - Esperá 1 minuto.

✅ Listo cuando el deployment dice **Ready**.

## Paso 4: entrar y quedar como superadmin

> ⚠️ Hacé este paso apenas termines el 3. **La primera persona que se registra queda como superadmin.**

1. En Vercel, tocá **Visit** (o la dirección que termina en `.vercel.app`).
2. La primera vez dice "Preparando el sistema por primera vez…": esperá unos segundos.
3. Aparece **"Bienvenido: creá tu usuario de superadmin"**. Escribí tu nombre, tu correo y una clave (mínimo 8 letras o números). Tocá **Crear mi usuario de superadmin**.
4. Entrás directo. Arriba a la derecha dice **Superadmin**.

👉 **Guardá la dirección de la web** en tus favoritos y pasásela a tu equipo.

## Paso 5: cargar los pedidos

1. En la web, pestaña **Cargar pedidos**.
2. Tocá **Subir Excel de pedidos** y elegí tu archivo (por ejemplo `orders_1.xlsx`).
3. En unos segundos se completan Resumen, Ofrecer ahora y Clientes.

Cuando tengas pedidos nuevos, repetí este paso con el Excel actualizado.

---

## Opcional: activar la IA (unos US$ 4 por mes, estimado)

El sistema funciona sin IA. Si querés los botones de recomendación con Claude:

1. Entrá a **console.anthropic.com** y creá una cuenta.
2. **Billing** → cargá US$ 10 con tarjeta.
3. **Limits** → poné un límite mensual de US$ 10. Así nunca gasta más que eso.
4. **API Keys** → **Create Key** → nombre `recompras` → **copiá la clave** (se muestra una sola vez).
5. Volvé a Vercel → tu proyecto → **Settings** → **Environment Variables**.
6. En **Key** escribí exactamente `ANTHROPIC_API_KEY`. En **Value** pegá la clave. Tocá **Save**.
7. Pestaña **Deployments** → ⋯ en la primera fila → **Redeploy**.

✅ En la ficha de un cliente aparece el botón violeta **Recomendar con IA**.

## Opcional: tu propio dominio

Para que la dirección sea, por ejemplo, `recompras.mercadodigital.com.py`:

1. Vercel → tu proyecto → **Settings** → **Domains** → escribí la dirección → **Add**.
2. Vercel muestra un dato que empieza con **CNAME**. Mandáselo a quien maneja el dominio de Mercado Digital para que lo cargue.

---

## Cómo entra tu equipo

1. Les pasás la dirección de la web.
2. Cada uno toca **No tengo usuario: crear uno**, pone su correo y una clave. Queda **esperando aprobación** y no ve nada.
3. Vos vas a la pestaña **Usuarios**: aparece en **Por aprobar**. Elegís *Usuario* o *Administrador* y tocás **Aprobar**.
4. Le avisás y toca **Ya me aprobaron, entrar**.

| Nivel | Qué puede hacer |
|---|---|
| Usuario | Ve clientes y listas, usa la IA y marca clientes como ofrecidos. |
| Administrador | Lo anterior, más cargar pedidos y cambiar ciclos. No aprueba gente. |
| Superadmin (vos) | Todo. Es el único que aprueba, rechaza, cambia niveles y genera claves. |

**Si alguien se olvida la clave:** Usuarios → **Nueva clave** al lado de su nombre. La web te muestra una clave nueva; se la pasás por WhatsApp.

**Si alguien deja la empresa:** Usuarios → **Quitar acceso**. Deja de ver datos al instante.

## Si algo falla

| Lo que ves | Qué hacer |
|---|---|
| "Falta conectar la base de datos" | Repetí el **Paso 3**, sin olvidarte del **Redeploy** del final. |
| "No se pudo preparar la base de datos" | Mandale una captura a Claude. |
| Al registrarte dice "esperando aprobación" y no sos superadmin | Alguien se registró antes que vos. Mandale una captura a Claude y te dice cómo corregirlo. |
| El botón de IA da error | Revisá que `ANTHROPIC_API_KEY` esté bien escrita en Vercel, que haya saldo en Anthropic y que hayas hecho **Redeploy**. |
