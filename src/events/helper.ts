import { Injectable } from '@nestjs/common';

@Injectable()
export class StaticService {
  private payload: string = '';
  onModuleInit() {
    this.payload = JSON.stringify(generateLargePayload());
  }

  getCachedPayload() {
    return this.payload;
  }

  getNewPayload() {
    return generateLargePayload();
  }
}

export const generateLargePayload = () => {
  const baseData = {
    time: new Date().toISOString(),
    timestamp: Date.now(),
    systemMetrics: {
      cpu: Array.from({ length: 50 }, (_, i) => ({
        core: i,
        usage: Math.random() * 100,
        temperature: 30 + Math.random() * 40,
        frequency: 2400 + Math.random() * 1000,
      })),
      memory: {
        total: 16777216,
        used: Math.floor(Math.random() * 10000000),
        available: Math.floor(Math.random() * 6777216),
        buffers: Math.floor(Math.random() * 1000000),
        cached: Math.floor(Math.random() * 2000000),
        processes: Array.from({ length: 20 }, (_, i) => ({
          pid: 1000 + i,
          name: `process_${i}`,
          memory: Math.floor(Math.random() * 100000),
          cpu: Math.random() * 10,
        })),
      },
      network: {
        interfaces: ['eth0', 'eth1', 'lo'].map((name) => ({
          name,
          bytesIn: Math.floor(Math.random() * 1000000000),
          bytesOut: Math.floor(Math.random() * 1000000000),
          packetsIn: Math.floor(Math.random() * 1000000),
          packetsOut: Math.floor(Math.random() * 1000000),
          errors: Math.floor(Math.random() * 100),
        })),
      },
      disk: Array.from({ length: 3 }, (_, i) => ({
        device: `/dev/sda${i + 1}`,
        size: 1000000000 + Math.random() * 500000000,
        used: Math.random() * 800000000,
        available: Math.random() * 200000000,
        mountPoint: i === 0 ? '/' : `/mnt/disk${i}`,
      })),
    },
  };

  const jsonStr = JSON.stringify(baseData);
  const targetSize = 1024;
  if (jsonStr.length < targetSize) {
    baseData['padding'] = 'x'.repeat(Math.floor(targetSize - jsonStr.length));
  }

  return baseData;
};

export const generateNewsContent = () => {
  return {
    articles: Array(10)
      .fill(null)
      .map((_, i) => ({
        id: i,
        title: `Article ${i}: Important news about ${Math.random().toString(36)}`,
        summary: 'Lorem ipsum '.repeat(50), // Large content for compression benefits
        author: 'News Reporter',
        category: ['Tech', 'Business', 'Sports'][i % 3],
      })),
    weather: {
      temperature: Math.round(Math.random() * 40),
      condition: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)],
    },
    stocks: Array(5)
      .fill(null)
      .map(() => ({
        symbol: Math.random().toString(36).substr(2, 4).toUpperCase(),
        price: (Math.random() * 1000).toFixed(2),
        change: ((Math.random() - 0.5) * 10).toFixed(2),
      })),
  };
};

// Newsletter JSON Generator Functions

/**
 * Generates a random newsletter-style JSON payload
 * @param targetSizeKB - Target size in KB (50 or 100)
 * @returns JSON object with newsletter content
 */
export function generateNewsletterJSON(targetSizeKB: 50 | 100 = 50): any {
  const targetBytes = targetSizeKB * 1024;

  const newsletter = {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    version: '1.0',
    newsletter: {
      title: generateNewsletterTitle(),
      subtitle: generateSubtitle(),
      edition: Math.floor(Math.random() * 1000) + 1,
      date: new Date().toISOString().split('T')[0],
      editor: generatePersonName(),
      categories: generateCategories(),
      featured: generateFeaturedStory(),
      articles: [] as any,
      advertisements: [] as any,
      subscriber_stats: generateSubscriberStats(),
      metadata: generateMetadata(),
      footer: generateFooter(),
      padding: '',
    },
  };

  // Fill with articles until we reach target size
  let currentSize = JSON.stringify(newsletter).length;

  while (currentSize < targetBytes * 0.85) {
    // Leave 15% buffer for ads and final content
    newsletter.newsletter.articles.push(generateArticle());
    currentSize = JSON.stringify(newsletter).length;

    if (
      currentSize > targetBytes * 0.6 &&
      newsletter.newsletter.advertisements.length < 3
    ) {
      newsletter.newsletter.advertisements.push(generateAdvertisement());
      currentSize = JSON.stringify(newsletter).length;
    }
  }

  // Add padding content if needed to reach exact size
  if (currentSize < targetBytes) {
    newsletter.newsletter.padding = generatePaddingContent(
      targetBytes - currentSize,
    );
  }

  return newsletter;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateNewsletterTitle(): string {
  const titles = [
    'Tech Weekly Digest',
    'Business Insider Report',
    'Global News Roundup',
    'Innovation Spotlight',
    'Market Analysis Today',
    'Digital Transformation Weekly',
    'Startup Ecosystem Update',
    'Finance & Economics Brief',
    'AI & Technology Review',
    'Industry Intelligence Report',
    'Future Trends Newsletter',
    'Executive Summary Weekly',
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

function generateSubtitle(): string {
  const subtitles = [
    'Your weekly dose of industry insights and breaking news',
    'Comprehensive analysis of market trends and emerging technologies',
    'Essential updates for business leaders and decision makers',
    'Deep dive into the latest developments shaping our world',
    'Strategic intelligence for the modern professional',
  ];
  return subtitles[Math.floor(Math.random() * subtitles.length)];
}

function generatePersonName(): string {
  const firstNames = [
    'Sarah',
    'Michael',
    'Jennifer',
    'David',
    'Emily',
    'Robert',
    'Lisa',
    'James',
    'Maria',
    'John',
  ];
  const lastNames = [
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Garcia',
    'Miller',
    'Davis',
    'Rodriguez',
    'Martinez',
    'Hernandez',
  ];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function generateCategories(): string[] {
  const allCategories = [
    'Technology',
    'Business',
    'Finance',
    'Healthcare',
    'Education',
    'Environment',
    'Politics',
    'Science',
    'Entertainment',
    'Sports',
    'Travel',
    'Food',
    'Fashion',
    'Real Estate',
    'Automotive',
    'Energy',
    'Telecommunications',
    'Retail',
  ];

  const numCategories = Math.floor(Math.random() * 5) + 3;
  return allCategories.sort(() => 0.5 - Math.random()).slice(0, numCategories);
}

function generateFeaturedStory(): any {
  return {
    headline: generateHeadline(),
    summary: generateParagraph(150, 250),
    author: generatePersonName(),
    read_time: Math.floor(Math.random() * 10) + 3,
    image_url: `https://example.com/images/${Math.floor(Math.random() * 1000)}.jpg`,
    tags: generateTags(),
    engagement: {
      views: Math.floor(Math.random() * 50000) + 1000,
      shares: Math.floor(Math.random() * 1000) + 50,
      comments: Math.floor(Math.random() * 500) + 10,
    },
  };
}

function generateArticle(): any {
  const numParagraphs = Math.floor(Math.random() * 4) + 2;
  const content: any = [];

  for (let i = 0; i < numParagraphs; i++) {
    content.push(generateParagraph(200, 400));
  }

  return {
    id: generateUUID(),
    headline: generateHeadline(),
    category: generateCategories()[0],
    author: generatePersonName(),
    published_date: new Date(
      Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    content: content,
    summary: generateParagraph(80, 120),
    tags: generateTags(),
    read_time: Math.floor(Math.random() * 15) + 2,
    related_articles: generateRelatedArticles(),
    social_media: {
      twitter_url: `https://twitter.com/example/status/${Math.floor(Math.random() * 1000000)}`,
      linkedin_url: `https://linkedin.com/post/${Math.floor(Math.random() * 1000000)}`,
      facebook_url: `https://facebook.com/post/${Math.floor(Math.random() * 1000000)}`,
    },
    metrics: {
      click_through_rate: (Math.random() * 0.15 + 0.01).toFixed(3),
      engagement_score: (Math.random() * 10).toFixed(1),
      reader_retention: (Math.random() * 0.8 + 0.2).toFixed(2),
    },
  };
}

function generateHeadline(): string {
  const headlines = [
    'Revolutionary AI Technology Transforms Industry Standards',
    'Market Volatility Reaches New Heights Amid Global Uncertainty',
    'Breakthrough Research Reveals Surprising Health Benefits',
    'Tech Giants Announce Major Partnership Initiative',
    'Climate Change Solutions Show Promising Early Results',
    'Cryptocurrency Market Experiences Unprecedented Growth',
    'Innovation in Renewable Energy Sector Accelerates',
    'Global Supply Chain Disruptions Continue to Impact Businesses',
    'Emerging Technologies Reshape Traditional Business Models',
    'Scientific Discovery Could Change Everything We Know',
    'Economic Indicators Point to Significant Market Shifts',
    'Digital Transformation Accelerates Across Industries',
  ];
  return headlines[Math.floor(Math.random() * headlines.length)];
}

function generateParagraph(minWords: number, maxWords: number): string {
  const words = [
    'analysis',
    'development',
    'innovation',
    'technology',
    'business',
    'market',
    'growth',
    'strategy',
    'implementation',
    'solution',
    'opportunity',
    'challenge',
    'transformation',
    'efficiency',
    'productivity',
    'sustainability',
    'collaboration',
    'integration',
    'optimization',
    'performance',
    'competitive',
    'advantage',
    'research',
    'data',
    'insights',
    'trends',
    'forecast',
    'revenue',
    'investment',
    'capital',
    'resources',
    'infrastructure',
    'platform',
    'ecosystem',
    'framework',
    'methodology',
    'approach',
    'initiative',
    'project',
    'outcome',
    'results',
    'impact',
    'benefits',
    'value',
    'quality',
    'excellence',
    'leadership',
    'management',
    'operations',
    'processes',
    'systems',
    'network',
    'communication',
    'engagement',
    'experience',
    'customer',
    'stakeholder',
    'partnership',
    'relationship',
    'governance',
    'compliance',
    'security',
    'privacy',
    'risk',
    'mitigation',
    'monitoring',
    'evaluation',
    'assessment',
    'planning',
    'execution',
    'delivery',
    'achievement',
  ];

  const targetWords =
    Math.floor(Math.random() * (maxWords - minWords)) + minWords;
  const sentences: any = [];
  let currentWords = 0;

  while (currentWords < targetWords) {
    const sentenceLength = Math.floor(Math.random() * 15) + 8;
    const sentence: any = [];

    for (let i = 0; i < sentenceLength && currentWords < targetWords; i++) {
      sentence.push(words[Math.floor(Math.random() * words.length)]);
      currentWords++;
    }

    if (sentence.length > 0) {
      sentence[0] = sentence[0].charAt(0).toUpperCase() + sentence[0].slice(1);
      sentences.push(sentence.join(' ') + '.');
    }
  }

  return sentences.join(' ');
}

function generateTags(): string[] {
  const allTags = [
    'breaking',
    'trending',
    'analysis',
    'exclusive',
    'interview',
    'report',
    'update',
    'investigation',
    'opinion',
    'feature',
    'spotlight',
    'review',
    'preview',
    'recap',
  ];

  const numTags = Math.floor(Math.random() * 4) + 2;
  return allTags.sort(() => 0.5 - Math.random()).slice(0, numTags);
}

function generateRelatedArticles(): any[] {
  const numRelated = Math.floor(Math.random() * 3) + 1;
  const related: any = [];

  for (let i = 0; i < numRelated; i++) {
    related.push({
      id: generateUUID(),
      title: generateHeadline(),
      url: `https://example.com/articles/${Math.floor(Math.random() * 10000)}`,
    });
  }

  return related;
}

function generateAdvertisement(): any {
  return {
    id: generateUUID(),
    type: 'banner',
    title: 'Premium Service Advertisement',
    content: generateParagraph(50, 100),
    click_url: `https://example-ads.com/click/${Math.floor(Math.random() * 100000)}`,
    image_url: `https://example-ads.com/banners/${Math.floor(Math.random() * 1000)}.jpg`,
    target_audience: generateCategories().slice(0, 2),
    campaign_metrics: {
      impressions: Math.floor(Math.random() * 100000) + 10000,
      clicks: Math.floor(Math.random() * 1000) + 100,
      conversion_rate: (Math.random() * 0.05 + 0.01).toFixed(3),
    },
  };
}

function generateSubscriberStats(): any {
  return {
    total_subscribers: Math.floor(Math.random() * 500000) + 50000,
    new_subscribers_this_week: Math.floor(Math.random() * 5000) + 100,
    open_rate: (Math.random() * 0.3 + 0.15).toFixed(3),
    click_rate: (Math.random() * 0.1 + 0.02).toFixed(3),
    unsubscribe_rate: (Math.random() * 0.02 + 0.001).toFixed(4),
    geographic_distribution: {
      'North America': (Math.random() * 0.4 + 0.3).toFixed(2),
      Europe: (Math.random() * 0.3 + 0.2).toFixed(2),
      Asia: (Math.random() * 0.2 + 0.15).toFixed(2),
      Other: (Math.random() * 0.1 + 0.05).toFixed(2),
    },
  };
}

function generateMetadata(): any {
  return {
    newsletter_id: generateUUID(),
    template_version: '2.1.0',
    generation_timestamp: new Date().toISOString(),
    content_hash: Math.random().toString(36).substring(2, 15),
    delivery_settings: {
      send_time: '09:00:00 UTC',
      timezone: 'UTC',
      frequency: 'weekly',
      next_delivery: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    personalization: {
      dynamic_content: true,
      location_based: true,
      interest_based: true,
      reading_history: true,
    },
  };
}

function generateFooter(): any {
  return {
    company_info: {
      name: 'Newsletter Publishing Inc.',
      address: '123 Business Street, Suite 456, City, State 12345',
      website: 'https://newsletter-example.com',
      contact_email: 'contact@newsletter-example.com',
      phone: '+1 (555) 123-4567',
    },
    legal: {
      privacy_policy: 'https://newsletter-example.com/privacy',
      terms_of_service: 'https://newsletter-example.com/terms',
      unsubscribe_url: 'https://newsletter-example.com/unsubscribe',
      copyright: `© ${new Date().getFullYear()} Newsletter Publishing Inc. All rights reserved.`,
    },
    social_links: {
      twitter: 'https://twitter.com/newsletter_example',
      linkedin: 'https://linkedin.com/company/newsletter-example',
      facebook: 'https://facebook.com/newsletter.example',
      instagram: 'https://instagram.com/newsletter_example',
    },
  };
}

function generatePaddingContent(targetBytes: number): string {
  const paddingWords =
    'padding content data information text content placeholder filler space buffer additional extra supplementary auxiliary complementary';
  const words = paddingWords.split(' ');
  let padding = '';

  while (padding.length < targetBytes - 100) {
    padding += words[Math.floor(Math.random() * words.length)] + ' ';
  }

  return padding.trim();
}
