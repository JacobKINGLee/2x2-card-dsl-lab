const baseFact={unit:'',progressSemantics:'none',scale:null,polarity:'asserted',status:'current',role:'primary',required:true};
const fact=value=>({...baseFact,...value});
const doc=({domain='generic',topic='信息摘要',facts=[],actions,presentation,ambiguities=[],task='card',state='informative',emphasis='standard'})=>({
  version:'2.0',task,domain,topic,state,emphasis,facts,
  actions:actions??{mode:'unmentioned',requests:[],forbiddenIntents:[]},
  presentation:presentation??{title:'default',primaryVisual:'default',button:'default'},ambiguities,
});
const action=(id,intent,label,event,target,extra={})=>({id,intents:[intent],label,event,target,available:true,...extra});

export const metadata={
  name:'qwen-semantic-v2-independent-2026-09-07',
  independent:true,
  purpose:'在 v2 协议、提示、规则和校准集冻结后编写；未用于实现修复或提示调整，等待首次 Qwen 运行',
};

export const dataset=[
  {
    id:'ind-01',split:'independent',category:'fact-only-paraphrase',text:'请做状态卡：这台平板目前还有64%的电，不需要操作入口。',context:{},
    confirmedSemantics:doc({domain:'energy',topic:'平板电量',facts:[fact({id:'battery',subject:'tabletBattery',label:'剩余电量',value:'64',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',source:'还有64%的电'})],actions:{mode:'forbidden_all',requests:[],forbiddenIntents:[]}}),
    expected:{semantics:{},decision:{status:'ready',components:['text','miniProgress'],delivery:'deliverable'}},
  },
  {
    id:'ind-02',split:'independent',category:'display-preference',text:'阅读进度到了37%，只放醒目的数字，不用进度条。',context:{},
    confirmedSemantics:doc({topic:'阅读进度',facts:[fact({id:'reading',subject:'reading',label:'阅读进度',value:'37',unit:'%',dataType:'percentage',progressSemantics:'completion',source:'阅读进度到了37%'})],presentation:{title:'default',primaryVisual:'big_number',button:'default'}}),
    expected:{semantics:{primaryVisual:'big_number'},decision:{status:'ready',components:['text','heroMetric'],delivery:'deliverable'}},
  },
  {
    id:'ind-03',split:'independent',category:'scoped-negation',text:'电池还剩41%。别清理内存，但给我一个查看电池详情的入口。',context:{actions:[action('batteryDetail','viewBatteryDetail','查看电池详情','openBatteryDetail','battery')]},
    confirmedSemantics:doc({domain:'energy',topic:'电池状态',facts:[fact({id:'battery',subject:'battery',label:'剩余电量',value:'41',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',source:'电池还剩41%'})],actions:{mode:'specified',requests:[{intent:'viewBatteryDetail',label:'查看电池详情',target:'battery',required:true}],forbiddenIntents:['cleanMemory']}}),
    expected:{semantics:{},decision:{status:'ready',components:['text','miniProgress','capsuleButton'],actionEvent:'openBatteryDetail',delivery:'deliverable'}},
  },
  {
    id:'ind-04',split:'independent',category:'duration-vs-score',text:'这一轮番茄钟已经专注了40分钟，展示时长即可。',context:{},
    confirmedSemantics:doc({domain:'productivity',topic:'番茄钟',facts:[fact({id:'focusDuration',subject:'focus',label:'专注时长',value:'40',unit:'分钟',dataType:'duration',source:'专注了40分钟'})]}),
    expected:{semantics:{},decision:{status:'ready',components:['text','heroMetric'],delivery:'deliverable'}},
  },
  {
    id:'ind-05',split:'independent',category:'correction-time',text:'访谈原先约在10:15，后来调整为11:45，请按新时间显示。',context:{},
    confirmedSemantics:doc({domain:'productivity',topic:'访谈时间',facts:[
      fact({id:'oldTime',subject:'interview',label:'原定时间',value:'10:15',dataType:'time',status:'superseded',role:'secondary',source:'原先约在10:15'}),
      fact({id:'newTime',subject:'interview',label:'访谈时间',value:'11:45',dataType:'time',source:'调整为11:45'}),
    ]}),
    expected:{semantics:{},decision:{status:'ready',components:['text','heroMetric'],delivery:'deliverable'}},
  },
  {
    id:'ind-06',split:'independent',category:'scaled-score',text:'本次体验评分4.6分，量表满分是5分。',context:{},
    confirmedSemantics:doc({topic:'体验评分',facts:[fact({id:'rating',subject:'experience',label:'体验评分',value:'4.6',unit:'分',dataType:'score',scale:{min:0,max:5},source:'评分4.6分，量表满分是5分'})]}),
    expected:{semantics:{},decision:{status:'ready',components:['text','progressRing'],delivery:'deliverable'}},
  },
  {
    id:'ind-07',split:'independent',category:'over-completion',text:'募捐目标已经达成135%，要保留真实的超额数字。',context:{},
    confirmedSemantics:doc({topic:'募捐进度',facts:[fact({id:'fundraising',subject:'fundraising',label:'目标完成度',value:'135',unit:'%',dataType:'percentage',progressSemantics:'completion',source:'达成135%'})]}),
    expected:{semantics:{},decision:{status:'ready',components:['text','miniProgress'],delivery:'deliverable'}},
  },
  {
    id:'ind-08',split:'independent',category:'missing-value',text:'血氧传感器暂时没有读数，请明确显示数据缺失。',context:{},
    confirmedSemantics:doc({domain:'wellness',topic:'血氧状态',facts:[fact({id:'oxygen',subject:'bloodOxygen',label:'血氧',value:null,dataType:'missing',status:'missing',source:'暂时没有读数'})]}),
    expected:{semantics:{},decision:{status:'ready',components:['text','text'],delivery:'deliverable'}},
  },
  {
    id:'ind-09',split:'independent',category:'fact-conflict',text:'同一只耳机的电量分别报23%和76%，目前无法判断哪一个可信。',context:{},
    confirmedSemantics:doc({domain:'energy',topic:'耳机电量',facts:[
      fact({id:'levelA',subject:'headphoneBattery',label:'耳机电量',value:'23',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',status:'conflicting',source:'报23%'}),
      fact({id:'levelB',subject:'headphoneBattery',label:'耳机电量',value:'76',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',status:'conflicting',source:'报76%'}),
    ],ambiguities:[{code:'conflicting_fact',factIds:['levelA','levelB'],question:'耳机电量应采用23%还是76%？'}]}),
    expected:{semantics:{ambiguityCount:1},decision:{status:'needs_clarification',code:'conflicting_fact',delivery:'not_applicable'}},
  },
  {
    id:'ind-10',split:'independent',category:'unverified-resource',text:'把刚才选中的风景图作为卡片主体。',context:{image:{id:'selected-landscape',src:'/selected-landscape.jpg',alt:'山谷风景',verified:false}},
    confirmedSemantics:doc({topic:'风景图',facts:[fact({id:'image',subject:'image',label:'风景图',value:null,dataType:'image',status:'current',source:'选中的风景图'})]}),
    expected:{semantics:{},decision:{status:'unsupported',code:'unverified_image_resource',delivery:'not_applicable'}},
  },
  {
    id:'ind-11',split:'independent',category:'icon-action',text:'用图标按钮暂停现在播放的音频。',context:{actions:[action('pause','pauseMedia','暂停播放','pauseCurrentAudio','media',{icon:'bell-off',iconReviewed:true})]},
    confirmedSemantics:doc({domain:'system',topic:'音频播放',facts:[fact({id:'playback',subject:'media',label:'播放状态',value:'播放中',dataType:'text',source:'现在播放的音频'})],actions:{mode:'specified',requests:[{intent:'pauseMedia',label:'暂停播放',target:'media',required:true}],forbiddenIntents:[]},presentation:{title:'default',primaryVisual:'default',button:'icon'}}),
    expected:{semantics:{},decision:{status:'ready',components:['text','text','iconButton'],actionEvent:'pauseCurrentAudio',delivery:'deliverable'}},
  },
  {
    id:'ind-12',split:'independent',category:'non-card',text:'解释一下为什么秋天的树叶会变色。',context:{},
    confirmedSemantics:doc({task:'non_card',topic:'知识问答',facts:[]}),
    expected:{semantics:{task:'non_card'},decision:{status:'no_card',code:'non_card_request',delivery:'not_applicable'}},
  },
];
