package com.research.assistant;

import lombok.Data;

@Data
public class ResearchRequest {
    private String content;
    private String operation;
    private String text;
    private String targetLanguage; // e.g., "hi", "mr", "de"
}
