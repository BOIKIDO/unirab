// Shared email templates - edit HERE; both real and simulated orders use this.
const TEMPLATE = `<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your UNIRAB order is confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f7f5;color:#102a2a;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Your UNIRAB order is confirmed. Here’s what happens next.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f2f7f5;">
    <tr>
      <td align="center" style="padding:32px 14px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dfe7e4;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:28px 34px;background-color:#073c38;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size:24px;font-weight:900;font-style:italic;letter-spacing:-1px;color:#ffffff;">
                    UNI<span style="color:#ff735d;">RAB</span><span style="color:#ff735d;font-size:18px;vertical-align:top;">•</span>
                  </td>
                  <td align="right" style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#bfe0d5;">
                    Order confirmed
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:42px 34px 18px;">
              <div style="width:50px;height:50px;line-height:50px;border-radius:50%;background-color:#eaf7f2;color:#073c38;text-align:center;font-size:24px;font-weight:900;">✓</div>
              <h1 style="margin:22px 0 12px;font-size:32px;line-height:1.18;letter-spacing:-1px;color:#102a2a;">Thanks for your order, {{first_name}}.</h1>
              <p style="margin:0;font-size:16px;line-height:1.65;color:#526460;">Your UNIRAB subscription is confirmed. We’ll begin preparing your business for stronger visibility across relevant AI platforms.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 34px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6faf8;border:1px solid #dfe7e4;border-radius:10px;">
                <tr>
                  <td style="padding:18px 20px;border-bottom:1px solid #dfe7e4;font-size:13px;color:#687674;">Plan</td>
                  <td align="right" style="padding:18px 20px;border-bottom:1px solid #dfe7e4;font-size:14px;font-weight:800;color:#102a2a;">{{plan}}</td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;font-size:13px;color:#687674;">Amount</td>
                  <td align="right" style="padding:18px 20px;font-size:18px;font-weight:900;color:#102a2a;">{{amount}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:2px 34px 14px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#e95543;">What happens next</p>
              <h2 style="margin:0;font-size:24px;line-height:1.3;color:#102a2a;">Your three-step roadmap</h2>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 34px 38px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="46" valign="top" style="padding:0 0 24px;">
                    <div style="width:34px;height:34px;line-height:34px;border-radius:50%;background-color:#ff735d;color:#ffffff;text-align:center;font-size:14px;font-weight:900;">1</div>
                  </td>
                  <td valign="top" style="padding:1px 0 24px;">
                    <p style="margin:0 0 5px;font-size:15px;font-weight:800;color:#102a2a;">We review your business details</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#687674;">Our team checks the information you submitted and identifies anything needed to begin your setup.</p>
                  </td>
                </tr>
                <tr>
                  <td width="46" valign="top" style="padding:0 0 24px;">
                    <div style="width:34px;height:34px;line-height:34px;border-radius:50%;background-color:#ff735d;color:#ffffff;text-align:center;font-size:14px;font-weight:900;">2</div>
                  </td>
                  <td valign="top" style="padding:1px 0 24px;">
                    <p style="margin:0 0 5px;font-size:15px;font-weight:800;color:#102a2a;">We build your visibility foundation</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#687674;">We organize and strengthen the business signals used by AI search and recommendation platforms.</p>
                  </td>
                </tr>
                <tr>
                  <td width="46" valign="top">
                    <div style="width:34px;height:34px;line-height:34px;border-radius:50%;background-color:#ff735d;color:#ffffff;text-align:center;font-size:14px;font-weight:900;">3</div>
                  </td>
                  <td valign="top" style="padding-top:1px;">
                    <p style="margin:0 0 5px;font-size:15px;font-weight:800;color:#102a2a;">We monitor and improve</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#687674;">We continue reviewing your visibility and make plan-appropriate improvements each month.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 34px;background-color:#eaf7f2;border-top:1px solid #dfe7e4;">
              <p style="margin:0 0 7px;font-size:14px;font-weight:800;color:#073c38;">We’ll be in touch if we need anything else.</p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td align="center" style="padding:22px 20px 0;font-size:11px;line-height:1.6;color:#7a8885;">
              © 2026 UNIRAB · AI visibility for local businesses
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export function confirmationEmailHtml(obj) {
  let html = TEMPLATE;
  for (const [k, v] of Object.entries(obj)) html = html.split('{{' + k + '}}').join(String(v ?? ''));
  return html;
}
