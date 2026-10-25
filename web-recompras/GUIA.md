# Cómo publicar la web de Recompras

Tiempo total: unos 40 minutos. No hace falta programar: solo crear cuentas, copiar y pegar.

Al terminar vas a tener una web con su propia dirección. Cualquiera puede crear su usuario, pero **nadie ve datos de clientes hasta que vos lo aprobás**.

## Qué vas a usar

| Servicio | Para qué | Costo para empezar |
|---|---|---|
| **Supabase** | Base de datos y usuarios | Plan gratis |
| **Vercel** | Publicar la web | Plan gratis |
| **Anthropic Console** | La IA (Claude Haiku 5.5) | Se paga por uso. Estimado: unos US$ 4 por mes con 5.000 consultas. Confirmá el precio vigente al cargar crédito. |

Tené a mano un documento de texto para ir pegando las claves que vas copiando.

---

## Paso 1: base de datos (Supabase)

1. Entrá a **supabase.com** y creá una cuenta (podés usar tu GitHub).
2. **New project**. Nombre: `recompras`. Elegí una contraseña fuerte para la base y guardala. Región: **South America (São Paulo)**, la más cercana a Paraguay.
3. Esperá unos 2 minutos a que se cree.
4. Menú izquierdo → **SQL Editor** → **New query**.
5. Abrí el archivo `web-recompras/supabase/schema.sql` en tu GitHub, copiá **todo** el contenido, pegalo y tocá **Run**. Tiene que decir "Success".
6. Menú izquierdo → **Project Settings** → **API**. Copiá a tu documento:
   - **Project URL**: es tu `SUPABASE_URL`.
   - **anon public**: es tu `SUPABASE_ANON_KEY`.
   - **service_role** (tocá "Reveal"): es tu `SUPABASE_SERVICE_ROLE_KEY`. **Esta es secreta: no la mandes por WhatsApp ni la pegues en ningún otro lado.**

## Paso 2: la IA (Anthropic Console)

1. Entrá a **console.anthropic.com** y creá una cuenta.
2. En **Billing**, cargá un crédito chico para empezar (por ejemplo US$ 10).
3. En **Limits**, poné un **límite de gasto mensual**, por ejemplo US$ 10. Así la IA nunca gasta más de eso aunque la usen mucho.
4. En **API Keys**, tocá **Create Key**, ponele de nombre `recompras-web` y copiala: es tu `ANTHROPIC_API_KEY`. Se muestra una sola vez.

La web además limita a cada usuario a 60 consultas por hora.

## Paso 3: publicar la web (Vercel)

1. Entrá a **vercel.com** y creá una cuenta **con tu GitHub**.
2. **Add New → Project** → elegí el repositorio **Mercadodigital** → **Import**.
3. Antes de publicar, configurá:
   - **Root Directory**: tocá Edit y elegí la carpeta `web-recompras`.
   - **Framework Preset**: `Other`.
   - **Environment Variables**: agregá las 4 claves de tu documento, una por una, con estos nombres exactos:
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `ANTHROPIC_API_KEY`
4. Tocá **Deploy**. En 1 o 2 minutos te da una dirección del tipo `recompras-xxxx.vercel.app`.

> Si el código todavía no está en la rama principal (`main`), en Vercel → Settings → Git → **Production Branch** poné `ccr-27f68a46-559fxk`. O pedime que lo pase a `main`.

## Paso 4: conectar el login con tu web

1. Volvé a Supabase → **Authentication** → **URL Configuration**.
2. En **Site URL** pegá la dirección que te dio Vercel (por ejemplo `https://recompras-xxxx.vercel.app`) y guardá.

Sin este paso, los correos de confirmación y de "olvidé mi clave" mandan a una dirección equivocada.

## Paso 5: hacerte administrador

1. Abrí tu web y tocá **No tengo usuario: crear uno**. Usá tu correo.
2. Confirmá el correo que te llega y entrá. Vas a ver "esperando aprobación": es normal, falta un paso.
3. En Supabase → **SQL Editor** → **New query**, pegá esto **cambiando el correo por el tuyo** y tocá **Run**:

   ```sql
   update public.perfiles set rol = 'admin' where email = 'TU_CORREO@ejemplo.com';
   ```

4. Recargá la web. Ya sos administrador.

Este paso se hace una sola vez. A los demás los aprobás desde la web, en la pestaña **Usuarios**.

## Paso 6: cargar los pedidos

1. En la web, pestaña **Cargar pedidos**.
2. Subí el Excel de pedidos (por ejemplo `orders_1.xlsx`).
3. Listo: Resumen, Ofrecer ahora y Clientes se completan solos.

Cada vez que tengas pedidos nuevos, subí el Excel actualizado. Si el Excel trae número de pedido, se suma sin duplicar. Si no lo trae, reemplaza todo lo anterior.

## Paso 7 (opcional): tu propio dominio

Para que la dirección sea, por ejemplo, `recompras.mercadodigital.com.py`:

1. Vercel → tu proyecto → **Settings** → **Domains** → escribí `recompras.mercadodigital.com.py` → **Add**.
2. Vercel te muestra un registro **CNAME**. Mandáselo a quien administra el dominio de Mercado Digital para que lo agregue. Tarda de minutos a unas horas.
3. Volvé a Supabase → Authentication → URL Configuration y cambiá el **Site URL** por la dirección nueva.

## Cómo entra tu equipo

1. Les pasás la dirección de la web.
2. Cada uno toca **Crear usuario** y confirma su correo.
3. Vos entrás a la pestaña **Usuarios** y les cambiás el acceso de *Pendiente* a *Usuario* (o *Administrador*).

| Acceso | Qué puede hacer |
|---|---|
| Pendiente | Nada. No ve ningún dato. |
| Usuario | Ve clientes y listas, usa la IA y marca clientes como ofrecidos. |
| Administrador | Todo lo anterior, más cargar pedidos, cambiar los ciclos y aprobar usuarios. |

## Si algo falla

| Problema | Solución |
|---|---|
| La web dice "Falta configurar el sistema" | Revisá en Vercel que las 4 variables estén con el nombre exacto, y volvé a publicar (Deployments → Redeploy). |
| No llega el correo de confirmación | El plan gratis de Supabase manda pocos correos por hora. Esperá un rato, o desactivá la confirmación en Authentication → Providers → Email → **Confirm email**. Los datos siguen protegidos porque igual tenés que aprobar a cada usuario. |
| El botón de IA da error de clave | Revisá `ANTHROPIC_API_KEY` en Vercel y que haya crédito en la consola de Anthropic. |
| Un usuario aprobado no ve datos | Que cierre sesión (botón **Salir**) y vuelva a entrar. |
