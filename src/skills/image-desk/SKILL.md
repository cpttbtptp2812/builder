---
name: image-desk
description: 影像识表 — 凭证切块、识别、按置信度取舍
triggers:
  - 借款凭证
  - 凭证影像
  - 扫描件
  - 影像识别
steps:
  - id: crop
    label: 把凭证切成六块
    tool: __image_crop__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: ocr
    label: 逐块识别文字和置信度
    tool: __image_ocr__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: accept
    label: 低于置信度线的字段弃用
    tool: __image_accept__
    args:
      query: "{{query}}"
      minConfidence: 0.7
  - id: report
    label: 写出采用的字段表
    tool: __image_report__
    args:
      query: "{{query}}"
      minConfidence: 0.7
---

# image-desk

借款凭证扫描件按标题、借款人、金额、期限、账号、印章切块。每块有坐标、识别文字和置信度。低于置信度线的不写入业务字段。
