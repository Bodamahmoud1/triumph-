#!/usr/bin/env python3
"""Generate the Arabic Triumph Laundry product presentation as a dependency-free PPTX."""
from __future__ import annotations

import argparse
import html
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

EMU = 914400
W, H = 13.333, 7.5

NAVY = "0F1E42"
NAVY_2 = "182B58"
GOLD = "C5A05A"
GOLD_2 = "E3C984"
IVORY = "F7F3EA"
WHITE = "FFFFFF"
INK = "172033"
MUTED = "64748B"
PALE = "F4F7FB"
LINE = "DDE4EE"
GREEN = "2F7D5B"
RED = "C44E4E"
BLUE = "2B52A8"
CYAN = "1593A5"
ORANGE = "D57B35"


def esc(value: object) -> str:
    return html.escape(str(value), quote=False)


def emu(v: float) -> int:
    return round(v * EMU)


def color(hex_value: str, alpha: int | None = None) -> str:
    a = f'<a:alpha val="{alpha}"/>' if alpha is not None else ""
    return f'<a:srgbClr val="{hex_value}">{a}</a:srgbClr>'


@dataclass
class Shape:
    kind: str
    x: float
    y: float
    w: float
    h: float
    text: str = ""
    fill: str = WHITE
    line: str = "none"
    radius: bool = False
    font_size: float = 18
    font_color: str = INK
    bold: bool = False
    align: str = "r"
    valign: str = "mid"
    rtl: bool = True
    font: str = "Noto Sans Arabic"
    margin: float = 0.12
    rotation: float = 0
    transparency: int | None = None
    paragraphs: list[tuple[str, int, bool, str]] | None = None


@dataclass
class Slide:
    title: str
    shapes: list[Shape] = field(default_factory=list)
    background: str = PALE
    number: int = 1
    dark: bool = False

    def add(self, shape: Shape) -> None:
        self.shapes.append(shape)


class Deck:
    def __init__(self) -> None:
        self.slides: list[Slide] = []

    def slide(self, title: str, background: str = PALE, dark: bool = False) -> Slide:
        s = Slide(title=title, background=background, number=len(self.slides) + 1, dark=dark)
        self.slides.append(s)
        return s


def box(slide: Slide, x: float, y: float, w: float, h: float, *, fill=WHITE, line="none", radius=True,
        text="", fs=18, fc=INK, bold=False, align="r", valign="mid", rtl=True, margin=.12,
        transparency=None, rotation=0, font="Noto Sans Arabic") -> None:
    slide.add(Shape("shape", x, y, w, h, text, fill, line, radius, fs, fc, bold, align, valign, rtl,
                    font, margin, rotation, transparency))


def text(slide: Slide, value: str, x: float, y: float, w: float, h: float, *, fs=18, fc=INK,
         bold=False, align="r", valign="mid", rtl=True, font="Noto Sans Arabic", margin=.02) -> None:
    slide.add(Shape("text", x, y, w, h, value, "none", "none", False, fs, fc, bold, align, valign,
                    rtl, font, margin))


def line(slide: Slide, x: float, y: float, w: float, h: float, *, stroke=GOLD, width="19050") -> None:
    slide.add(Shape("line", x, y, w, h, "", "none", f"{stroke}:{width}"))


def circle(slide: Slide, x: float, y: float, d: float, *, fill=GOLD, text_value="", fs=18, fc=WHITE,
           bold=True) -> None:
    slide.add(Shape("ellipse", x, y, d, d, text_value, fill, "none", False, fs, fc, bold, "ctr", "mid"))


def header(slide: Slide, kicker: str, title_value: str, subtitle: str = "") -> None:
    text(slide, kicker, 9.95, .38, 2.55, .32, fs=10.5, fc=GOLD, bold=True)
    text(slide, title_value, 3.5, .72, 9.0, .62, fs=28, fc=NAVY, bold=True)
    line(slide, 10.98, 1.43, 1.52, 0, stroke=GOLD, width="28575")
    if subtitle:
        text(slide, subtitle, 3.0, 1.55, 9.5, .42, fs=13, fc=MUTED)


def footer(slide: Slide) -> None:
    fc = "B8C2D4" if slide.dark else "8995A8"
    text(slide, "TRIUMPH  •  LAUNDRY OPERATIONS", .62, 7.04, 4.2, .2, fs=7.5, fc=fc,
         align="l", rtl=False, font="Aptos")
    text(slide, f"{slide.number:02d}", 12.15, 7.02, .55, .22, fs=8.5, fc=GOLD, bold=True,
         align="r", rtl=False, font="Aptos")


def icon_badge(slide: Slide, x: float, y: float, label: str, color_value: str = GOLD, size=.54) -> None:
    circle(slide, x, y, size, fill=color_value, text_value=label, fs=15, fc=WHITE)


def add_bullets(slide: Slide, items: Iterable[str], x: float, y: float, w: float, *, fs=15.5,
                gap=.58, color_value=INK, accent=GOLD) -> None:
    for idx, item in enumerate(items):
        yy = y + idx * gap
        circle(slide, x + w - .23, yy + .12, .11, fill=accent)
        text(slide, item, x, yy, w - .36, .4, fs=fs, fc=color_value, valign="top")


def build_deck() -> Deck:
    d = Deck()

    # 1 — Cover
    s = d.slide("الغلاف", NAVY, dark=True)
    box(s, 0, 0, W, H, fill=NAVY, radius=False)
    box(s, 0, 0, 4.15, H, fill=NAVY_2, radius=False)
    box(s, .55, .55, 3.05, 6.4, fill="1C315F", line="2B4070", radius=True)
    for i, (c, yy, dd) in enumerate([(GOLD, .9, 1.12), (CYAN, 2.45, .72), (WHITE, 3.62, 1.5), (GOLD_2, 5.55, .54)]):
        circle(s, 1.48 + (i % 2) * .5, yy, dd, fill=c, text_value="" if i != 2 else "T", fs=35, fc=NAVY)
    text(s, "دليل تشغيل", 5.0, 1.05, 7.1, .62, fs=20, fc=GOLD, bold=True)
    text(s, "مغسلة فندق تريومف", 4.8, 1.65, 7.35, 1.0, fs=36, fc=WHITE, bold=True)
    text(s, "منصة رقمية متكاملة لإدارة عمليات الغسيل اليومية", 5.15, 2.82, 6.95, .56,
         fs=17, fc="DDE5F2")
    line(s, 9.8, 3.62, 2.3, 0, stroke=GOLD, width="38100")
    text(s, "الكيماويات  •  برامج الغسيل  •  الجداول  •  المهام", 5.15, 3.9, 6.95, .42,
         fs=13.5, fc=WHITE)
    box(s, 8.55, 5.08, 3.55, .64, fill=GOLD, text="TRIUMPH LUXURY HOTEL", fs=11.5,
        fc=NAVY, bold=True, align="ctr", rtl=False, font="Aptos", radius=True)
    text(s, "LAUNDRY OPERATIONS GUIDE", 7.5, 5.85, 4.6, .3, fs=9, fc="AEBBD1", bold=True,
         align="r", rtl=False, font="Aptos")
    footer(s)

    # 2 — overview
    s = d.slide("نبذة")
    header(s, "01  /  نظرة عامة", "منصة واحدة تدعم التشغيل اليومي", "مرجع موحّد، سريع، ومصمم خصيصًا لفريق المغسلة")
    features = [
        ("01", "الكيماويات", "مرجع الجرعات والاستخدام الآمن", GOLD),
        ("02", "برامج الغسيل", "خطوات مفصلة لكل نوع من الأقمشة", BLUE),
        ("03", "جدول العمل", "عرض الورديات والأسبوع التشغيلي", ORANGE),
        ("04", "المهام", "مسؤوليات واضحة لأعضاء الفريق", GREEN),
        ("05", "النصائح", "إرشادات عملية للجودة والسلامة", CYAN),
        ("06", "إدارة مركزية", "تحديث المحتوى والنشر من لوحة واحدة", RED),
    ]
    for i, (num, ttl, desc, c) in enumerate(features):
        col, row = i % 3, i // 3
        x, y = .72 + col * 4.12, 2.16 + row * 1.78
        box(s, x, y, 3.76, 1.42, fill=WHITE, line=LINE, radius=True)
        circle(s, x + 2.96, y + .28, .52, fill=c, text_value=num, fs=11, fc=WHITE)
        text(s, ttl, x + .25, y + .22, 2.55, .36, fs=16, fc=NAVY, bold=True)
        text(s, desc, x + .25, y + .72, 3.14, .42, fs=11.5, fc=MUTED, valign="top")
    box(s, .72, 5.98, 11.9, .6, fill=NAVY, text="الوصول إلى المعلومة الصحيحة خلال ثوانٍ — من أي جهاز", fs=15,
        fc=WHITE, bold=True, align="ctr")
    footer(s)

    # 3 — challenge
    s = d.slide("التحديات")
    header(s, "02  /  الحاجة", "من التشتت التشغيلي إلى مرجع موحّد", "المنصة تربط المعرفة اليومية بالإدارة والتنفيذ")
    box(s, .7, 2.15, 5.62, 3.96, fill="FFF8F5", line="F0D8D1", radius=True)
    text(s, "قبل المنصة", 3.55, 2.44, 2.25, .4, fs=18, fc=RED, bold=True)
    add_bullets(s, ["معلومات موزعة بين أوراق وملفات", "صعوبة مراجعة الجرعات أثناء العمل", "اختلاف تنفيذ البرامج بين الموظفين", "تحديث الجداول يدويًا", "تدريب أبطأ للموظفين الجدد"], 1.05, 3.05, 4.72, fs=13.4, gap=.53, accent=RED)
    box(s, 7.0, 2.15, 5.62, 3.96, fill="F4FBF8", line="CFE7DC", radius=True)
    text(s, "مع الدليل الرقمي", 9.46, 2.44, 2.6, .4, fs=18, fc=GREEN, bold=True)
    add_bullets(s, ["مصدر واحد معتمد للمعلومات", "بحث سريع ووصول مباشر للجرعات", "إجراءات تشغيل متسقة", "نشر مركزي للجداول والمحتوى", "مرجع واضح للتعلّم والتدريب"], 7.35, 3.05, 4.72, fs=13.4, gap=.53, accent=GREEN)
    circle(s, 6.12, 3.6, 1.08, fill=GOLD, text_value="←", fs=25, fc=NAVY)
    text(s, "إجراءات موحّدة  •  أخطاء أقل  •  جودة أعلى", 2.8, 6.38, 7.72, .35, fs=15, fc=NAVY, bold=True, align="ctr")
    footer(s)

    # 4 — chemicals
    s = d.slide("الكيماويات")
    header(s, "03  /  المعرفة التشغيلية", "دليل الكيماويات — المعلومة في سياقها", "11 مادة كيميائية موثّقة للاستخدام اليومي")
    box(s, .7, 2.03, 4.15, 4.54, fill=NAVY, radius=True)
    circle(s, 1.22, 2.55, 1.04, fill=GOLD, text_value="11", fs=23, fc=NAVY)
    text(s, "مادة كيميائية", 2.45, 2.57, 1.82, .35, fs=16, fc=WHITE, bold=True)
    line(s, 1.2, 3.82, 3.14, 0, stroke="43557A")
    text(s, "لكل مادة", 1.15, 4.08, 3.2, .3, fs=12, fc=GOLD, bold=True)
    add_bullets(s, ["الاسم والرمز", "الغرض وطريقة العمل", "الجرعات والحرارة", "التطبيقات والتنبيهات"], 1.2, 4.55, 3.1, fs=12.5, gap=.43, color_value=WHITE, accent=GOLD)
    cards = [
        ("تعريف واضح", "وصف مبسّط للمادة ووظيفتها", "A", GOLD),
        ("جرعات دقيقة", "بيانات تشغيل تدعم القرار السريع", "ml", BLUE),
        ("سلامة الاستخدام", "تنبيهات ودرجات حرارة مناسبة", "!", RED),
        ("تطبيق عملي", "ربط المادة ببرامج الغسيل", "✓", GREEN),
    ]
    for i, (ttl, desc, symbol, c) in enumerate(cards):
        col, row = i % 2, i // 2
        x, y = 5.25 + col * 3.68, 2.23 + row * 1.86
        box(s, x, y, 3.34, 1.48, fill=WHITE, line=LINE, radius=True)
        circle(s, x + 2.56, y + .28, .48, fill=c, text_value=symbol, fs=12, fc=WHITE)
        text(s, ttl, x + .24, y + .25, 2.12, .34, fs=14.2, fc=NAVY, bold=True)
        text(s, desc, x + .24, y + .78, 2.74, .44, fs=10.9, fc=MUTED, valign="top")
    box(s, 5.25, 6.0, 7.02, .56, fill=IVORY, line="E7D5AB", text="مرجع سريع يساعد على تقليل الخطأ والهدر", fs=13.5, fc=NAVY, bold=True, align="ctr")
    footer(s)

    # 5 — programs
    s = d.slide("البرامج")
    header(s, "04  /  التنفيذ", "برامج الغسيل — خطوات دقيقة من البداية للنهاية", "13 برنامجًا تشمل الحرارة، الوقت، المياه، والمواد المستخدمة")
    stages = [
        ("01", "شطف", "ماء بارد", CYAN), ("02", "غسيل", "منظف + حرارة", BLUE),
        ("03", "تبييض", "حسب نوع النسيج", GOLD), ("04", "معادلة", "ضبط متبقيات القلوية", GREEN),
        ("05", "تنعيم", "اللمسة النهائية", ORANGE),
    ]
    for i, (num, ttl, sub, c) in enumerate(stages):
        x = .58 + i * 2.52
        circle(s, x + .62, 2.45, .86, fill=c, text_value=num, fs=13, fc=WHITE)
        if i < len(stages) - 1:
            line(s, x + 1.48, 2.88, 1.04, 0, stroke="C7D0DD", width="19050")
        text(s, ttl, x + .15, 3.48, 1.78, .33, fs=15, fc=NAVY, bold=True, align="ctr")
        text(s, sub, x, 3.92, 2.08, .38, fs=10.5, fc=MUTED, align="ctr")
    box(s, .72, 4.65, 11.9, 1.5, fill=WHITE, line=LINE, radius=True)
    metrics = [("55–70°", "درجات تشغيل نموذجية"), ("الوقت", "مدة كل مرحلة والبرنامج"), ("مل/كجم", "جرعة دقيقة للحمولة"), ("مل/ماكينة", "تحويل عملي للمشغّل")]
    for i, (value, label) in enumerate(metrics):
        x = .96 + i * 2.92
        text(s, value, x, 4.96, 2.38, .4, fs=18, fc=GOLD if i == 0 else NAVY, bold=True, align="ctr", rtl=i != 0)
        text(s, label, x, 5.48, 2.38, .32, fs=10.5, fc=MUTED, align="ctr")
        if i < 3:
            line(s, x + 2.62, 4.94, 0, .78, stroke=LINE, width="12700")
    footer(s)

    # 6 — schedule
    s = d.slide("الجدول")
    header(s, "05  /  التنسيق", "جدول العمل الأسبوعي — رؤية أوضح للورديات", "من المعاينة إلى النشر، ضمن تجربة واحدة")
    box(s, .68, 2.02, 8.18, 4.38, fill=WHITE, line=LINE, radius=True)
    text(s, "الأسبوع التشغيلي", 6.32, 2.24, 1.96, .34, fs=13.5, fc=NAVY, bold=True)
    days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء"]
    for i, day in enumerate(days):
        x = 1.0 + i * 1.46
        box(s, x, 2.82, 1.23, .46, fill=NAVY, text=day, fs=9.5, fc=WHITE, bold=True, align="ctr", radius=True)
        shifts = [("صباح", "FFF2E6", ORANGE), ("مساء", "EDF2FF", BLUE), ("ليل", "E9EDF5", NAVY)]
        for j, (lab, fillc, fc) in enumerate(shifts):
            box(s, x, 3.48 + j * .72, 1.23, .5, fill=fillc, line="none", text=lab, fs=9.5, fc=fc, bold=True, align="ctr", radius=True)
    box(s, 9.25, 2.02, 3.38, 4.38, fill=NAVY, radius=True)
    text(s, "إدارة الجدول", 9.7, 2.43, 2.43, .38, fs=17, fc=WHITE, bold=True)
    add_bullets(s, ["رفع ملف الجدول", "معاينة قبل النشر", "التنقل بين الأسابيع", "طباعة ومشاركة", "توضيح الإجازات"], 9.62, 3.2, 2.45, fs=11.6, gap=.51, color_value=WHITE, accent=GOLD)
    box(s, 9.68, 5.82, 2.38, .46, fill=GOLD, text="نشر الجدول  ✓", fs=11, fc=NAVY, bold=True, align="ctr")
    footer(s)

    # 7 — tasks tips
    s = d.slide("المهام والنصائح")
    header(s, "06  /  دعم الفريق", "المهام والنصائح — معرفة قابلة للتنفيذ", "محتوى يومي يرفع الاتساق ويختصر وقت التدريب")
    box(s, .72, 2.12, 5.72, 4.15, fill=NAVY, radius=True)
    circle(s, 5.2, 2.54, .62, fill=GOLD, text_value="✓", fs=18, fc=NAVY)
    text(s, "المهام الوظيفية", 2.82, 2.54, 2.05, .38, fs=19, fc=WHITE, bold=True)
    add_bullets(s, ["توضيح مسؤوليات كل وظيفة", "توزيع الأعمال بين أعضاء الفريق", "دعم متابعة الإنجاز اليومي", "مرجع للتهيئة والتدريب"], 1.15, 3.48, 4.72, fs=13.2, gap=.58, color_value=WHITE, accent=GOLD)
    box(s, 6.9, 2.12, 5.72, 4.15, fill=WHITE, line=LINE, radius=True)
    circle(s, 11.38, 2.54, .62, fill=CYAN, text_value="i", fs=18, fc=WHITE)
    text(s, "النصائح التشغيلية", 8.84, 2.54, 2.15, .38, fs=19, fc=NAVY, bold=True)
    add_bullets(s, ["التعامل الصحيح مع الأقمشة", "الاستخدام الآمن للكيماويات", "تحسين جودة الغسيل والتشطيب", "تقليل التلف وإعادة الغسيل"], 7.33, 3.48, 4.72, fs=13.2, gap=.58, color_value=INK, accent=CYAN)
    footer(s)

    # 8 — admin
    s = d.slide("لوحة الإدارة")
    header(s, "07  /  الإدارة", "لوحة تحكم مركزية — تحديث، مراجعة، ونشر", "أدوات الإدارة في واجهة واضحة وآمنة")
    box(s, .68, 2.0, 8.48, 4.58, fill=WHITE, line=LINE, radius=True)
    box(s, .68, 2.0, 1.72, 4.58, fill=NAVY, radius=True)
    text(s, "TRIUMPH", .96, 2.38, 1.15, .3, fs=10.5, fc=GOLD, bold=True, align="ctr", rtl=False, font="Aptos")
    navs = ["لوحة القيادة", "الجداول", "المحتوى", "الموظفون", "المشرفون", "سجل المراجعة"]
    for i, nav in enumerate(navs):
        fillc = GOLD if i == 0 else "none"
        fc = NAVY if i == 0 else "D6DEEC"
        box(s, .91, 3.0 + i * .48, 1.27, .35, fill=fillc, text=nav, fs=8.3, fc=fc, bold=i == 0, align="ctr", radius=True)
    text(s, "لوحة القيادة", 6.8, 2.3, 1.85, .36, fs=16, fc=NAVY, bold=True)
    stats = [("11", "كيماويات", GOLD), ("13", "برامج", BLUE), ("✓", "جدول منشور", GREEN)]
    for i, (val, lab, c) in enumerate(stats):
        x = 2.78 + i * 1.92
        box(s, x, 2.96, 1.6, 1.1, fill=PALE, line=LINE, radius=True)
        text(s, val, x + .15, 3.12, 1.3, .35, fs=20, fc=c, bold=True, align="ctr", rtl=False)
        text(s, lab, x + .15, 3.58, 1.3, .24, fs=8.8, fc=MUTED, align="ctr")
    box(s, 2.78, 4.4, 5.84, 1.55, fill=PALE, line=LINE, radius=True)
    for i, width in enumerate([4.72, 3.85, 4.3, 2.96]):
        box(s, 3.16, 4.72 + i * .26, width, .09, fill="D8E0EC", radius=True)
    box(s, 9.52, 2.0, 3.1, 4.58, fill=NAVY, radius=True)
    text(s, "قدرات الإدارة", 10.05, 2.42, 2.03, .36, fs=17, fc=WHITE, bold=True)
    add_bullets(s, ["تحرير المحتوى", "إدارة الموظفين", "صلاحيات المشرفين", "تتبّع التغييرات", "نشر آمن"], 9.92, 3.22, 2.22, fs=11.8, gap=.51, color_value=WHITE, accent=GOLD)
    footer(s)

    # 9 — UX and tech
    s = d.slide("التجربة والتقنية")
    header(s, "08  /  التجربة", "مصممة للعمل على كل شاشة — وفي كل وردية", "واجهة عربية متجاوبة تدعم السرعة والوضوح")
    # device mockups
    box(s, .78, 2.25, 4.72, 3.32, fill=NAVY, radius=True)
    box(s, 1.1, 2.58, 4.08, 2.44, fill=WHITE, radius=True)
    box(s, 1.36, 2.85, 3.56, .42, fill=GOLD, text="دليل المغسلة", fs=11, fc=NAVY, bold=True, align="ctr")
    for i in range(3):
        box(s, 1.38 + i * 1.15, 3.56, .92, .96, fill=PALE, line=LINE, radius=True)
    line(s, 2.54, 5.62, 1.2, 0, stroke=NAVY, width="38100")
    box(s, 4.75, 3.15, 1.55, 3.02, fill=NAVY_2, radius=True)
    box(s, 4.91, 3.42, 1.23, 2.3, fill=WHITE, radius=True)
    box(s, 5.05, 3.68, .95, .34, fill=GOLD, text="TRIUMPH", fs=6.8, fc=NAVY, bold=True, align="ctr", rtl=False)
    for i in range(3):
        box(s, 5.08, 4.24 + i * .43, .88, .25, fill=PALE, radius=True)
    features = [("RTL", "لغة عربية واتجاه صحيح", GOLD), ("PWA", "تجربة تطبيق ويب", BLUE), ("24/7", "وصول سريع أثناء العمل", GREEN), ("SEC", "مصادقة وصلاحيات", RED), ("DARK", "وضع ليلي مريح", NAVY), ("PRINT", "طباعة ومرجع سريع", CYAN)]
    for i, (code, label, c) in enumerate(features):
        col, row = i % 2, i // 2
        x, y = 7.0 + col * 2.78, 2.28 + row * 1.22
        box(s, x, y, 2.45, .92, fill=WHITE, line=LINE, radius=True)
        circle(s, x + 1.76, y + .19, .48, fill=c, text_value=code, fs=7.5, fc=WHITE)
        text(s, label, x + .15, y + .23, 1.48, .42, fs=10.5, fc=NAVY, bold=True)
    footer(s)

    # 10 — value
    s = d.slide("القيمة")
    header(s, "09  /  الأثر", "قيمة تشغيلية قابلة للقياس", "المنصة تربط الجودة بالسرعة والسلامة والإدارة")
    rows = [
        ("الجودة", "توحيد برامج وإجراءات الغسيل", GOLD),
        ("السرعة", "الوصول الفوري إلى المعلومات", BLUE),
        ("السلامة", "استخدام أوضح للمواد الكيميائية", RED),
        ("التدريب", "تهيئة أسرع للموظفين الجدد", CYAN),
        ("التكلفة", "تقليل الأخطاء والهدر وإعادة الغسيل", GREEN),
        ("التواصل", "وضوح الورديات والمهام", ORANGE),
    ]
    for i, (area, impact, c) in enumerate(rows):
        col, row = i % 2, i // 2
        x, y = .76 + col * 6.14, 2.1 + row * 1.35
        box(s, x, y, 5.72, 1.02, fill=WHITE, line=LINE, radius=True)
        box(s, x + 4.46, y, 1.26, 1.02, fill=c, text=area, fs=13, fc=WHITE, bold=True, align="ctr", radius=True)
        text(s, impact, x + .28, y + .23, 3.88, .48, fs=13.2, fc=NAVY, bold=True)
    box(s, 2.05, 6.25, 9.23, .55, fill=NAVY, text="جودة أعلى  ×  وقت أقل  ×  قرارات أوضح", fs=15, fc=WHITE, bold=True, align="ctr")
    footer(s)

    # 11 — journey
    s = d.slide("رحلة المستخدم")
    header(s, "10  /  رحلة الاستخدام", "ست خطوات من السؤال إلى التنفيذ", "تجربة بسيطة تحافظ على تركيز الموظف أثناء العمل")
    steps = [
        ("1", "فتح الدليل"), ("2", "اختيار القسم"), ("3", "البحث السريع"),
        ("4", "مراجعة الجرعات"), ("5", "تنفيذ الخطوات"), ("6", "تأكيد الجودة"),
    ]
    for i, (num, label) in enumerate(steps):
        x = .55 + i * 2.12
        c = GOLD if i in (0, 5) else NAVY
        circle(s, x + .52, 2.6, .88, fill=c, text_value=num, fs=18, fc=NAVY if c == GOLD else WHITE)
        if i < 5:
            line(s, x + 1.4, 3.04, 1.24, 0, stroke="C7D0DD", width="19050")
        text(s, label, x + .03, 3.68, 1.84, .48, fs=12.2, fc=NAVY, bold=True, align="ctr")
    box(s, 1.05, 4.75, 11.22, 1.12, fill=NAVY, radius=True)
    text(s, "المعلومة الصحيحة", 8.82, 5.03, 2.65, .34, fs=17, fc=GOLD, bold=True, align="ctr")
    text(s, "للموظف المناسب", 5.38, 5.03, 2.65, .34, fs=17, fc=WHITE, bold=True, align="ctr")
    text(s, "في الوقت المناسب", 1.94, 5.03, 2.65, .34, fs=17, fc=GOLD, bold=True, align="ctr")
    footer(s)

    # 12 — close
    s = d.slide("الخاتمة", NAVY, dark=True)
    box(s, 0, 0, W, H, fill=NAVY, radius=False)
    box(s, 8.65, 0, 4.68, H, fill=NAVY_2, radius=False)
    for x, y, dd, c in [(9.35, .78, 1.35, GOLD), (11.15, 1.7, .62, CYAN), (9.8, 3.2, 1.96, WHITE), (11.42, 5.45, .76, GOLD_2)]:
        circle(s, x, y, dd, fill=c, text_value="")
    text(s, "نحو تشغيل أكثر كفاءة وجودة", 1.05, 1.22, 6.9, .78, fs=31, fc=WHITE, bold=True)
    line(s, 5.58, 2.28, 2.37, 0, stroke=GOLD, width="38100")
    text(s, "دليل مغسلة تريومف هو مرجع تشغيلي موحّد يدعم الفريق،\nويرفع مستوى الجودة والسلامة والتنظيم.",
         1.05, 2.68, 6.9, 1.22, fs=17, fc="DCE4F0", valign="top")
    box(s, 1.05, 4.48, 6.9, .76, fill=GOLD, text="معرفة أوضح  •  تشغيل أسرع  •  جودة أفضل", fs=16,
        fc=NAVY, bold=True, align="ctr")
    text(s, "شكرًا لكم", 1.05, 5.78, 6.9, .52, fs=22, fc=WHITE, bold=True)
    text(s, "TRIUMPH LUXURY HOTEL", 1.05, 6.42, 6.9, .3, fs=9, fc="AAB7CC", bold=True,
         align="r", rtl=False, font="Aptos")
    footer(s)
    return d


def tx_body(shape: Shape) -> str:
    anchor = {"top": "t", "mid": "ctr", "bottom": "b"}.get(shape.valign, "ctr")
    inset = emu(shape.margin)
    body_pr = f'<a:bodyPr rtlCol="0" anchor="{anchor}" lIns="{inset}" rIns="{inset}" tIns="{inset}" bIns="{inset}"/>'
    paras = []
    lines = shape.text.split("\n") or [""]
    for value in lines:
        align = {"r": "r", "l": "l", "ctr": "ctr"}.get(shape.align, "r")
        rtl = ' rtl="1"' if shape.rtl else ""
        lang = "ar-SA" if shape.rtl else "en-US"
        bold = ' b="1"' if shape.bold else ""
        size = int(shape.font_size * 100)
        run = (f'<a:r><a:rPr lang="{lang}" sz="{size}"{bold} dirty="0">'
               f'<a:solidFill>{color(shape.font_color)}</a:solidFill><a:latin typeface="{esc(shape.font)}"/>'
               f'<a:ea typeface="{esc(shape.font)}"/><a:cs typeface="{esc(shape.font)}"/></a:rPr>'
               f'<a:t>{esc(value)}</a:t></a:r>')
        paras.append(f'<a:p><a:pPr algn="{align}"{rtl}/>{run}<a:endParaRPr lang="{lang}" sz="{size}"/></a:p>')
    return f'<p:txBody>{body_pr}<a:lstStyle/>{"".join(paras)}</p:txBody>'


def shape_xml(shape: Shape, sid: int) -> str:
    x, y, cx, cy = map(emu, (shape.x, shape.y, shape.w, shape.h))
    rot = f' rot="{int(shape.rotation * 60000)}"' if shape.rotation else ""
    xfrm = f'<a:xfrm{rot}><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
    if shape.kind == "line":
        stroke, width = shape.line.split(":")
        return (f'<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="{sid}" name="Line {sid}"/><p:cNvCxnSpPr/>'
                f'<p:nvPr/></p:nvCxnSpPr><p:spPr>{xfrm}<a:prstGeom prst="line"><a:avLst/></a:prstGeom>'
                f'<a:ln w="{width}"><a:solidFill>{color(stroke)}</a:solidFill></a:ln></p:spPr></p:cxnSp>')
    geom = "ellipse" if shape.kind == "ellipse" else ("roundRect" if shape.radius else "rect")
    fill = '<a:noFill/>' if shape.fill == "none" else f'<a:solidFill>{color(shape.fill, shape.transparency)}</a:solidFill>'
    if shape.line == "none":
        ln = '<a:ln><a:noFill/></a:ln>'
    else:
        ln = f'<a:ln w="12700"><a:solidFill>{color(shape.line)}</a:solidFill></a:ln>'
    text_xml = tx_body(shape) if shape.text or shape.kind in {"text", "ellipse"} else ""
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="Shape {sid}"/><p:cNvSpPr txBox="1"/>'
            f'<p:nvPr/></p:nvSpPr><p:spPr>{xfrm}<a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>'
            f'{fill}{ln}</p:spPr>{text_xml}</p:sp>')


def slide_xml(slide: Slide) -> str:
    shapes = "".join(shape_xml(sh, i + 2) for i, sh in enumerate(slide.shapes))
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill>{color(slide.background)}</a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>{shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''


def write_pptx(deck: Deck, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    n = len(deck.slides)
    content_overrides = "".join(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for i in range(1, n + 1))
    content_types = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>{content_overrides}</Types>'''
    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''
    slide_ids = "".join(f'<p:sldId id="{255+i}" r:id="rId{i+1}"/>' for i in range(1, n + 1))
    presentation = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>{slide_ids}</p:sldIdLst><p:sldSz cx="{emu(W)}" cy="{emu(H)}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>'''
    pres_rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>']
    pres_rels += [f'<Relationship Id="rId{i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>' for i in range(1, n + 1)]
    presentation_rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(pres_rels) + '</Relationships>'
    slide_master = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Master"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="C5A05A" accent2="2B52A8" accent3="2F7D5B" accent4="C44E4E" accent5="1593A5" accent6="D57B35" bg1="FFFFFF" bg2="F4F7FB" folHlink="954F72" hlink="0563C1" tx1="172033" tx2="64748B"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'''
    master_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>'''
    layout = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'''
    layout_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'''
    theme = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Triumph"><a:themeElements><a:clrScheme name="Triumph"><a:dk1><a:srgbClr val="172033"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0F1E42"/></a:dk2><a:lt2><a:srgbClr val="F4F7FB"/></a:lt2><a:accent1><a:srgbClr val="C5A05A"/></a:accent1><a:accent2><a:srgbClr val="2B52A8"/></a:accent2><a:accent3><a:srgbClr val="2F7D5B"/></a:accent3><a:accent4><a:srgbClr val="C44E4E"/></a:accent4><a:accent5><a:srgbClr val="1593A5"/></a:accent5><a:accent6><a:srgbClr val="D57B35"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Triumph"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="Noto Sans Arabic"/><a:cs typeface="Noto Sans Arabic"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Noto Sans Arabic"/><a:cs typeface="Noto Sans Arabic"/></a:minorFont></a:fontScheme><a:fmtScheme name="Triumph"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'''
    core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>دليل تشغيل مغسلة فندق تريومف</dc:title><dc:subject>عرض تعريفي للمنصة</dc:subject><dc:creator>Triumph Laundry</dc:creator><cp:keywords>Arabic, Laundry, Operations, Triumph</cp:keywords><dc:description>عرض تقديمي عربي لمنصة دليل مغسلة فندق تريومف</dc:description><cp:lastModifiedBy>Triumph Laundry</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-06-12T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-12T00:00:00Z</dcterms:modified></cp:coreProperties>'''
    app = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Office PowerPoint</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>{n}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop><Company>Triumph Luxury Hotel</Company><AppVersion>16.0000</AppVersion></Properties>'''
    slide_rel = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'''
    files = {
        "[Content_Types].xml": content_types, "_rels/.rels": rels,
        "docProps/core.xml": core, "docProps/app.xml": app,
        "ppt/presentation.xml": presentation, "ppt/_rels/presentation.xml.rels": presentation_rels,
        "ppt/slideMasters/slideMaster1.xml": slide_master,
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": master_rels,
        "ppt/slideLayouts/slideLayout1.xml": layout,
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": layout_rels,
        "ppt/theme/theme1.xml": theme,
    }
    for i, s in enumerate(deck.slides, 1):
        files[f"ppt/slides/slide{i}.xml"] = slide_xml(s)
        files[f"ppt/slides/_rels/slide{i}.xml.rels"] = slide_rel
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data.encode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("deliverables/triumph-laundry-ar.pptx"))
    args = parser.parse_args()
    deck = build_deck()
    write_pptx(deck, args.output)
    print(f"Created {args.output} ({len(deck.slides)} slides, {args.output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
