# AI Query Templates

## Strategy: 6 total API calls per report
- 1 batch prompt per platform × 2 location levels (city + state) = 6 calls
- Each prompt contains ALL keywords for the business
- Parse all mentions from a single response per call

## Batch Prompt Template

```
You are a homeowner in {LOCATION} looking for local service businesses.
For each of the following service types, name the top 3 businesses you would recommend in {LOCATION}.
Be specific — use real business names if you know them.

Services to cover:
{KEYWORD_LIST}

Format your response as a list. For each service, list the businesses by name.
```

## Location Levels
- city: "{city}, {state}" (e.g., "Austin, TX")
- state: "{state}" (e.g., "Texas")

## Keyword List Example (roofing contractor)
- roof replacement
- roofing contractor
- roof repair
- emergency roof repair
- residential roofing
- commercial roofing
- roof inspection

## Mention Detection
After receiving each response:
1. Check if business_name (or any alias) appears verbatim
2. Run fuzzy match (threshold 0.85) for near-matches
3. Note position of first mention in response text
4. Count total mentions across response
