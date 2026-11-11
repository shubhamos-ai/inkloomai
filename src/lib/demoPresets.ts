/**
 * Demo presets used by the onboarding "Use Demo" shortcut.
 *
 * Kept in one module so the exact supplied company profile and brand
 * guidelines can be reused by onboarding, docs and tests without drift.
 */

export interface DemoCompanyPreset {
  companyName: string;
  industry: string;
  rulesText: string;
}

export const VELORA_DEMO_PRESET: DemoCompanyPreset = {
  companyName: 'VELORA Skincare Laboratories',
  industry: 'Skincare, dermatology-inspired cosmetics and personal care.',
  rulesText: `# VELORA – OFFICIAL COMPANY PROFILE & ADVERTISING COMPLIANCE RULES

## 1. COMPANY INFORMATION

Company Name: VELORA Skincare Laboratories

Industry: Skincare, Cosmetics, Dermatology-inspired Personal Care.

Company Description:

VELORA is a premium skincare company focused on developing gentle, science-led skincare products designed to support healthy-looking skin. The brand believes in transparency, authenticity, simplicity and responsible skincare communication. VELORA creates products for consumers seeking effective, carefully formulated skincare solutions without exaggerated promises or misleading marketing.

Target Audience: Adults aged 18–35 interested in skincare, acne care and everyday skin health.

Brand Personality: Premium, minimal, elegant, trustworthy, scientific, clean and approachable.

Brand Philosophy: Consumer trust and honest communication must always take priority over aggressive marketing and sales.

## 2. OFFICIAL BRAND IDENTITY

All advertisements must maintain VELORA's premium visual identity.

Approved brand colours:

- Warm Ivory: #F8F5EF
- Soft Beige: #E8DED0
- Sage Green: #A8B5A0
- Deep Forest: #34483B
- Charcoal: #292929

Strictly prohibited colours:
- Neon pink.
- Fluorescent yellow.
- Bright orange.
- Extremely saturated backgrounds.
- Unapproved gradients and excessive contrasting colours.

Typography requirements:
- Use clean, modern sans-serif typography.
- Maintain consistent font families and weights.
- Headlines must be readable and professionally aligned.
- Maintain sufficient spacing between text elements.
- Decorative cursive fonts are prohibited.
- Distorted, stretched, compressed or excessively oversized typography is prohibited.

Logo requirements:
- The company name must always appear as VELORA.
- Never distort, stretch, rotate or modify the official wordmark.
- Maintain original logo proportions.
- Maintain sufficient clear space around the logo.
- Use approved brand colours only.

## 3. PRODUCT ADVERTISING RULES

Product Name: Velora Advanced Acne Removal Cream.

Product Category: Acne-care skincare cream.

All product advertisements must:
- Display the product accurately.
- Maintain realistic packaging and product proportions.
- Keep product labels readable.
- Avoid exaggerated visual effects.
- Never invent product features or ingredients.
- Never visually imply results that have not been substantiated.

The product name and all associated performance claims must be reviewed for accuracy and scientific substantiation.

## 4. STRICTLY PROHIBITED ADVERTISING CLAIMS

VELORA does not permit misleading, exaggerated or medically unsupported advertising claims.

The following statements are strictly prohibited unless independently substantiated and legally approved:

- "Clear Acne Permanently."
- "Clear Acne Permanently in Just 3 Days."
- "100% Guaranteed Results."
- "Instant Acne Removal."
- "Permanent Skin Transformation."
- "Works for Everyone."
- "Guaranteed Acne-Free Skin."
- "Remove All Acne Overnight."
- Any statement promising guaranteed or permanent medical or cosmetic outcomes.

Additional restrictions:

- Never promise specific treatment timelines without reliable scientific evidence.
- Never claim that a cosmetic product cures a medical condition.
- Never fabricate scientific studies or clinical research.
- Never invent laboratory results or certifications.
- Never make unsupported dermatological effectiveness claims.
- Never use "Dermatologist Approved" without verifiable documentation and authorization.
- Never imply that a product has medical approval or certification without evidence.

Permitted examples:
- "Care for clearer-looking skin."
- "A gentle addition to your skincare routine."
- "Designed to support healthy-looking skin."
- "Skincare inspired by science and simplicity."

Every product claim must be accurate, evidence-based and appropriate for the product.

## 5. BEFORE-AND-AFTER IMAGE POLICY

Before-and-after transformations must represent genuine, documented results.

Strictly prohibited:
- Digitally removing acne or skin imperfections.
- Artificially smoothing skin to imply product effectiveness.
- Creating fictional customer transformations.
- Using manipulated before-and-after photographs.
- Using inconsistent lighting to exaggerate results.
- Presenting AI-generated transformations as genuine customer results.

All customer images must have appropriate usage permission.

## 6. PROMOTIONAL AND DISCOUNT RULES

All promotional claims must be truthful and verifiable.

Strictly prohibited:
- Fake discounts.
- Fabricated promotional offers.
- Fake countdown timers.
- Artificial urgency.
- False scarcity.
- Unauthorized discount percentages.
- Misleading "TODAY ONLY" claims.
- Fabricated sale stickers and promotional badges.

Discount percentages and campaign deadlines must be genuine, authorized and accurately represented.

## 7. HUMAN MODEL AND SKINCARE VISUAL GUIDELINES

- Use authentic-looking human photography.
- Maintain realistic skin texture.
- Avoid excessive digital skin smoothing.
- Avoid unrealistic beauty filters.
- Do not create misleading skin transformations.
- Represent natural skin characteristics.
- Avoid imagery that creates unrealistic beauty expectations.

## 8. ADVERTISEMENT LAYOUT AND COMPOSITION

VELORA advertisements must maintain a clean, premium and minimal composition.

Required:
- Clear visual hierarchy.
- Adequate whitespace.
- One primary headline.
- One primary product focus.
- Proper alignment.
- Readable supporting text.
- Consistent margins and spacing.
- Professional product presentation.

Prohibited:
- Excessive promotional stickers.
- Fake countdown timers.
- Overlapping text.
- Excessive badges.
- Visually cluttered compositions.
- Aggressive sales-oriented layouts.
- Unnecessary decorative elements.

## 9. SOCIAL MEDIA ADVERTISING FORMAT

Preferred platform: Instagram.

Preferred format:
- Portrait 4:5.
- Resolution: 1080 × 1350 pixels.

All text must be readable on mobile screens. Maintain safe margins and ensure the logo and product remain clearly visible.

## 10. ADVERTISEMENT COMPLIANCE CHECKLIST

Every advertisement must pass these checks:

1. Correct VELORA brand identity.
2. Approved colour palette.
3. Approved typography.
4. Correct and undistorted logo.
5. Accurate product representation.
6. No unsupported medical or cosmetic claims.
7. No guaranteed or permanent results claims.
8. No fabricated dermatologist endorsements.
9. No misleading before-and-after transformations.
10. No fake discounts or artificial urgency.
11. No fake countdown timers.
12. Realistic human imagery.
13. Premium and uncluttered composition.
14. Readable and properly aligned text.
15. All promotional statements must be verifiable.

## 11. VIOLATION SEVERITY CLASSIFICATION

CRITICAL VIOLATIONS:
- False medical claims.
- Guaranteed or permanent results claims without substantiation.
- Fabricated medical endorsements.
- Misleading before-and-after transformations.
- False claims of product effectiveness.

HIGH-SEVERITY VIOLATIONS:
- Fake discounts and promotional urgency.
- Fabricated countdown timers.
- Distorted company logos.
- Unverified product certifications.
- Misleading product representation.

MEDIUM-SEVERITY VIOLATIONS:
- Unapproved colours.
- Inconsistent typography.
- Excessive promotional stickers.
- Cluttered layouts.
- Minor visual identity inconsistencies.

## 12. FINAL DECISION POLICY

The advertising compliance system must evaluate every uploaded advertisement against ALL the above rules.

For each advertisement:

- Identify every detected violation.
- Quote or identify the exact problematic text or visual element.
- Explain which company rule has been violated.
- Assign a severity level: Critical, High or Medium.
- Provide a clear correction recommendation.
- Identify compliant elements as well as non-compliant elements.
- Never approve an advertisement containing unresolved critical violations.

Decision categories:

APPROVED: All mandatory compliance requirements are satisfied.

NEEDS REVISION: Non-critical violations exist and can be corrected before publication.

REJECTED: One or more critical violations exist, or serious misleading advertising is detected.

Do not assume that an advertisement is compliant merely because it looks professional or visually attractive.

Do not invent violations. Only flag issues supported by visible evidence or missing substantiation. Distinguish between a claim that is demonstrably false and a claim that cannot be verified from the supplied advertisement.

FINAL BRAND PRINCIPLE:

VELORA believes that trustworthy skincare marketing should educate consumers, communicate honestly and build long-term confidence. No advertisement should sacrifice consumer trust for clicks, attention or sales.

These rules are mandatory for all VELORA advertising campaigns, promotional materials, social media posts and product advertisements.`,
};
