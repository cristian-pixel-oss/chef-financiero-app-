/**
 * CHEF FINANCIERO — POST /api/send-invitation
 *
 * Recibe { email, inviteUrl, hotelName, role, invitedByName } y envía
 * el email de invitación vía Resend.
 *
 * Requiere variable de entorno: RESEND_API_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { Resend }                    from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Remitente: usa tu dominio verificado en Resend.
// Si aún no tienes dominio verificado, cambia a 'onboarding@resend.dev'
// (solo funciona enviando a tu propio email durante pruebas).
const FROM = process.env.RESEND_FROM_EMAIL ?? 'Chef Financiero <noreply@cheffinanciero.com>'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, inviteUrl, hotelName, role, invitedByName } = body as {
      email:          string
      inviteUrl:      string
      hotelName:      string
      role:           string
      invitedByName:  string
    }

    if (!email || !inviteUrl || !hotelName) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Etiqueta legible del rol
    const roleLabel =
      role === 'premium'  ? 'Premium'  :
      role === 'admin'    ? 'Admin'    : 'Estándar'

    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      [email],
      subject: `Invitación a Chef Financiero — ${hotelName}`,
      html:    buildHtml({ email, inviteUrl, hotelName, roleLabel, invitedByName }),
      text:    buildText({ email, inviteUrl, hotelName, roleLabel, invitedByName }),
    })

    if (error) {
      console.error('[send-invitation] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err) {
    console.error('[send-invitation] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// ─── Plantilla HTML ────────────────────────────────────────────────────────────

function buildHtml({
  email, inviteUrl, hotelName, roleLabel, invitedByName,
}: {
  email: string; inviteUrl: string; hotelName: string
  roleLabel: string; invitedByName: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación a Chef Financiero</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background-color:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2937;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1f2937;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                Chef <span style="color:#f59e0b;">Financiero</span>
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">
                Control de costos profesional para cocinas de hotel
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">

              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">
                ¡Tienes una invitación! 🎉
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;line-height:1.6;">
                <strong style="color:#e5e7eb;">${invitedByName}</strong> te ha invitado a unirte
                al equipo de <strong style="color:#e5e7eb;">${hotelName}</strong> en Chef Financiero.
              </p>

              <!-- Detalle de rol -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background-color:#1a2436;border-radius:10px;border:1px solid rgba(245,158,11,0.2);margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
                      Hotel
                    </p>
                    <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#f59e0b;">${hotelName}</p>
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
                      Tu rol
                    </p>
                    <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#ffffff;">${roleLabel}</p>
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
                      Correo asignado
                    </p>
                    <p style="margin:0;font-size:14px;color:#d1d5db;">${email}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}"
                       style="display:inline-block;background-color:#f59e0b;color:#111827;font-weight:700;
                              font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;
                              letter-spacing:0.3px;">
                      Aceptar invitación →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link alternativo -->
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-align:center;">
                Si el botón no funciona, copia este link en tu navegador:
              </p>
              <p style="margin:0;font-size:11px;color:#f59e0b;text-align:center;word-break:break-all;">
                ${inviteUrl}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1f2937;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.6;">
                Este link es personal e intransferible. Expira en <strong style="color:#6b7280;">7 días</strong>.<br/>
                Si no esperabas esta invitación, puedes ignorar este correo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Plantilla texto plano (fallback) ─────────────────────────────────────────

function buildText({
  email, inviteUrl, hotelName, roleLabel, invitedByName,
}: {
  email: string; inviteUrl: string; hotelName: string
  roleLabel: string; invitedByName: string
}) {
  return `Chef Financiero — Invitación

${invitedByName} te ha invitado a unirte al equipo de ${hotelName}.

Hotel:  ${hotelName}
Rol:    ${roleLabel}
Email:  ${email}

Acepta tu invitación aquí:
${inviteUrl}

Este link expira en 7 días.
Si no esperabas esta invitación, ignora este correo.
`
}
