// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import {
  BookOpenCheck,
  FilePenLine,
  GraduationCap,
  Microscope,
  Route,
  type LucideProps,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

import { BentoCard, BentoGrid } from "~/components/magicui/bento-grid";

import { SectionHeader } from "../components/section-header";

type FeatureIcon = {
  Icon: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
  href: string;
  className: string;
};

const featureIcons: Array<FeatureIcon> = [
  {
    Icon: GraduationCap,
    href: "https://github.com/yaodada123/deer-flow-ts/blob/main/src/server/workflow.ts",
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
  },
  {
    Icon: Microscope,
    href: "https://github.com/yaodada123/deer-flow-ts/tree/main/src/server/tools",
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
  },
  {
    Icon: Route,
    href: "https://github.com/yaodada123/deer-flow-ts/blob/main/src/server/chat/run-chat-workflow.ts",
    className: "lg:col-start-2 lg:col-end-3 lg:row-start-1 lg:row-end-2",
  },
  {
    Icon: BookOpenCheck,
    href: "https://github.com/yaodada123/deer-flow-ts/tree/main/src/server/evaluation",
    className: "lg:col-start-2 lg:col-end-3 lg:row-start-2 lg:row-end-3",
  },
  {
    Icon: FilePenLine,
    href: "https://github.com/yaodada123/deer-flow-ts/blob/main/src/server/app.ts",
    className: "lg:col-start-2 lg:col-end-3 lg:row-start-3 lg:row-end-4",
  },
];

export function CoreFeatureSection() {
  const t = useTranslations("landing.coreFeatures");
  const tCommon = useTranslations("common");
  const features = t.raw("features") as Array<{
    name: string;
    description: string;
  }>;

  return (
    <section className="relative flex w-full flex-col content-around items-center justify-center">
      <SectionHeader
        anchor="core-features"
        title={t("title")}
        description={t("description")}
      />
      <BentoGrid className="w-3/4 lg:grid-cols-2 lg:grid-rows-3">
        {features.map((feature, index) => {
          const iconData = featureIcons[index];
          return iconData ? (
            <BentoCard
              key={feature.name}
              {...iconData}
              {...feature}
              background={
                <img
                  alt="background"
                  className="absolute -top-20 -right-20 opacity-60"
                />
              }
              cta={tCommon("learnMore")}
            />
          ) : null;
        })}
      </BentoGrid>
    </section>
  );
}
