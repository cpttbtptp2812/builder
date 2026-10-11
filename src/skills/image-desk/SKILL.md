---
name: image-desk
description: 影像识表 — 区块契约、置信度取舍、必填字段守卫与多表交付
triggers:
  - 借款凭证
  - 凭证影像
  - 扫描件
  - 影像识别
steps:
  - id: intake
    label: 读入
    tool: __image_intake__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: schema
    label: 契约
    tool: __image_validate_schema__
    args:
      query: "{{query}}"
      requireColumns: "区块,识别文字,置信度,字段"
      failFast: true
      guard: fail
      minConfidence: 0.7
  - id: blocks
    label: 块数
    tool: __image_validate_blocks__
    args:
      query: "{{query}}"
      minBlocks: 1
      minConfidence: 0.7
  - id: crop
    label: 分块
    tool: __image_crop__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: ocr
    label: 识别
    tool: __image_ocr__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: hist
    label: 分布
    tool: __image_histogram__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: accept
    label: 取舍
    tool: __image_accept__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: req
    label: 必填
    tool: __image_required_guard__
    args:
      query: "{{query}}"
      requiredFields: "借款人,本次借款金额"
      blockOnRequiredReject: true
      minConfidence: 0.7
      guard: fail
  - id: f1
    label: 全表
    tool: __image_deliver_fields__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: f2
    label: 采用
    tool: __image_deliver_accepted__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: f3
    label: 弃用
    tool: __image_deliver_rejected__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: f4
    label: 复核
    tool: __image_deliver_qa__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: report
    label: 结论
    tool: __image_report__
    args:
      query: "{{query}}"
      minConfidence: 0.7
      requiredFields: "借款人,本次借款金额"
---

# image-desk

区块数、字段与置信度结果 **来自您导入的 OCR 区块表**；`minConfidence`、`requiredFields`、`minBlocks` 在 args 中配置。
