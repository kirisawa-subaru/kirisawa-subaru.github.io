---
title: 公式回归样例
description: 覆盖各种公式写法的草稿，CI 用它检查渲染；不会发布。
date: 2026-10-01
tags: [demo]
draft: true
---

3. [proved] 以列表项开头的段落，后面每行都是懒续行：\(f(n)=O(\log n)\)
令
\[
a_0=1,\qquad a_{k+1}=\bigl(a_k+\sqrt{a_k}\bigr)^2,
\qquad b_k=\ln a_k.
\]
于是
\[
\begin{aligned}
b_{k+1}&=2b_k+2\ln\!\left(1+a_k^{-1/2}\right)\\
&\le 2b_k+\frac{2}{\sqrt{a_k}}.
\end{aligned}
\tag{1}
\]
带框与编号：
\[
\boxed{
b_k\le C\,2^k,\qquad k\ge0.
}
\tag{2}
\]

一行中间的 \[\sum_{n\ge1}n^{-2}=\pi^2/6\] 也渲染成独立公式。

宽公式与中文下标：
\[
\boxed{
\begin{gathered}
\text{[proved]}\quad
S=\sum_{k=0}^{4n}T_k,\qquad
r_{\mathrm{上下}}(T_k)\,r_{\mathrm{左右}}(T_k)\le2^{\,2\sqrt2\,\lambda+O(\sqrt\lambda+\ln\lambda)},\\[2mm]
\text{[proved，长注释]}\quad
e\bigl(q^2\lceil64(\ln q)^3\rceil^2\bigr)\le\max\left\{q^{-1},\left(2^{-1/2}+\frac2{\ln q}\right)e(q)\right\}.
\end{gathered}
}
\]

美元记法：$\delta_{ad}\delta_{bc}=\delta_{ac}\delta_{bd}-\varepsilon_{ab}\varepsilon_{cd}$，下划线 $a_1 * b_2 * c_3$ 不变斜体。

$$
\mathcal{L}(\theta)=-\mathbb{E}_{x\sim\mathcal D}\bigl[\log\pi_\theta(y\mid x)\bigr]
\tag{A}
$$

- 列表项 \(\alpha\) 与 $\beta$
- 缩进的块公式：
  \[
  \int_0^1 x^n\,dx=\frac1{n+1}
  \]

> 引用里的 \(\langle\psi|\phi\rangle\)。

$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix}

\begin{cases} 1 & x>0 \\ 0 & \text{otherwise}\end{cases}
$$

普通美元：5 美元和 10 美元不是公式。
