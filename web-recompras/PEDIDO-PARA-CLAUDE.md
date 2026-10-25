# Pedido para Claude in Chrome

Copiá todo el texto del recuadro y pegalo en Claude in Chrome (en la computadora, con Vercel abierto).

```
Necesito que publiques mi web de recompras en Vercel. No sé programar: hacé vos los clics y pedime permiso o ayuda solo cuando haga falta (iniciar sesión, aceptar condiciones, pagar).

1. Entrá a vercel.com/new con mi cuenta (ya está creada con mi GitHub).
2. Importá el repositorio de GitHub "martinvierci97-star/Mercadodigital".
   - Project Name: recompras-md
   - No cambies Root Directory, Framework ni Build Settings: el repositorio trae su propio vercel.json.
   - Tocá Deploy y esperá a que termine.
3. En el proyecto recompras-md, pestaña Storage: creá una base Supabase (plan Free, región São Paulo, nombre "recompras") y conectala al proyecto recompras-md, en todos los entornos.
4. Pestaña Deployments: hacé Redeploy del último deployment y esperá a que diga Ready.
5. Abrí la web publicada (Visit). La primera vez dice "Preparando el sistema por primera vez": esperá. Cuando aparezca "Bienvenido: creá tu usuario de superadmin", PARÁ y avisame: ese usuario lo creo yo con mi correo y mi clave.
6. Decime la dirección final de la web (termina en .vercel.app).

Si algo da error, leé el mensaje, intentá resolverlo una vez y si no podés, mostrame el error exacto.
```

## Después, a mano (2 minutos)

1. En la web, creá tu usuario de superadmin con tu correo y una clave.
2. Pestaña **Cargar pedidos** → subí `orders_1.xlsx`.
3. Mandale la dirección de la web a Claude en la conversación de Mercado Digital.

## Opcional: activar la IA

Necesita una tarjeta, así que hacelo vos o pedíselo a Claude in Chrome y cargá vos los datos de pago:

1. console.anthropic.com → crear cuenta → Billing: cargar US$ 10 → Limits: límite mensual US$ 10.
2. API Keys → Create Key → copiarla.
3. Vercel → recompras-md → Settings → Environment Variables → `ANTHROPIC_API_KEY` = la clave → Save → Deployments → Redeploy.
