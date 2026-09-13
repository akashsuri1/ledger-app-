package com.ledgerflow.attachment;

import com.ledgerflow.config.LedgerFlowDataProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({LedgerFlowDataProperties.class, AttachmentProperties.class})
public class AttachmentConfiguration {}
