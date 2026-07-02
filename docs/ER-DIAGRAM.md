# Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ ORGANIZATION_MEMBERSHIP : belongs_to
    ORGANIZATION ||--o{ ORGANIZATION_MEMBERSHIP : has
    ORGANIZATION ||--o{ PROJECT : owns
    USER ||--o{ REFRESH_TOKEN : receives
    USER ||--o{ PROJECT : creates
    USER ||--o{ JOB : creates

    PROJECT ||--o{ RETRY_POLICY : defines
    PROJECT ||--o{ QUEUE : owns
    PROJECT ||--o{ JOB : contains
    PROJECT ||--o{ WORKER : registers
    PROJECT ||--o{ SCHEDULED_JOB : schedules
    PROJECT ||--o{ DEAD_LETTER_QUEUE : contains

    RETRY_POLICY o|--o{ QUEUE : defaults
    RETRY_POLICY o|--o{ JOB : governs
    RETRY_POLICY o|--o{ SCHEDULED_JOB : governs

    QUEUE ||--o{ JOB : receives
    QUEUE ||--o{ WORKER : scopes
    QUEUE ||--o{ SCHEDULED_JOB : receives
    QUEUE ||--o{ DEAD_LETTER_QUEUE : contains

    WORKER o|--o{ JOB : claims
    WORKER ||--o{ WORKER_HEARTBEAT : emits
    WORKER o|--o{ JOB_EXECUTION : performs

    JOB ||--o{ JOB_EXECUTION : attempts
    JOB ||--o{ JOB_LOG : records
    JOB ||--o| DEAD_LETTER_QUEUE : may_enter
    JOB_EXECUTION o|--o{ JOB_LOG : produces
```

The detailed key, cascade, normalization, and index rationale is in
[Database Design](DATABASE-DESIGN.md).

---

[GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
