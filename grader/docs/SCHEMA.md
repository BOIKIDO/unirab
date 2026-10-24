# Database Schema Reference

## research_jobs
| Column           | Type        | Notes                                      |
|------------------|-------------|--------------------------------------------|
| id               | uuid PK     | default gen_random_uuid()                  |
| business_name    | text        | NOT NULL                                   |
| website_url      | text        |                                            |
| primary_service  | text        |                                            |
| location_city    | text        |                                            |
| location_state   | text        |                                            |
| keywords         | text[]      | array of service keywords                  |
| status           | text        | pending / running / complete / failed      |
| score_overall    | int         | 0–100, null until complete                 |
| score_chatgpt    | int         |                                            |
| score_perplexity | int         |                                            |
| score_gemini     | int         |                                            |
| created_at       | timestamptz | default now()                              |

## query_results
| Column        | Type        | Notes                                      |
|---------------|-------------|--------------------------------------------|
| id            | uuid PK     |                                            |
| job_id        | uuid FK     | references research_jobs(id)               |
| platform      | text        | chatgpt / perplexity / gemini              |
| keyword       | text        |                                            |
| location_type | text        | city / state                               |
| query_text    | text        |                                            |
| response_text | text        |                                            |
| mentioned     | bool        | default false                              |
| mention_count | int         | default 0                                  |
| created_at    | timestamptz |                                            |

## competitors
| Column           | Type        | Notes                                      |
|------------------|-------------|--------------------------------------------|
| id               | uuid PK     |                                            |
| job_id           | uuid FK     | references research_jobs(id)               |
| competitor_name  | text        |                                            |
| mention_count    | int         |                                            |
| chatgpt_score    | int         |                                            |
| perplexity_score | int         |                                            |
| gemini_score     | int         |                                            |

## leads
| Column     | Type        | Notes                                      |
|------------|-------------|--------------------------------------------|
| id         | uuid PK     |                                            |
| job_id     | uuid FK     | references research_jobs(id)               |
| first_name | text        |                                            |
| last_name  | text        |                                            |
| email      | text        | NOT NULL                                   |
| phone      | text        |                                            |
| role       | text        |                                            |
| created_at | timestamptz |                                            |
