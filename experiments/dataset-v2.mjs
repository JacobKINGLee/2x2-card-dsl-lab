const baseFact = {
  unit: '', progressSemantics: 'none', scale: null, polarity: 'asserted', status: 'current', role: 'primary', required: true,
};
const fact = value => ({...baseFact,...value});
const doc = ({domain='generic',topic='信息摘要',facts=[],actions,presentation,ambiguities=[],task='card',state='informative',emphasis='standard'}) => ({
  version:'2.0',task,domain,topic,state,emphasis,facts,
  actions:actions ?? {mode:'unmentioned',requests:[],forbiddenIntents:[]},
  presentation:presentation ?? {title:'default',primaryVisual:'default',button:'default'},
  ambiguities,
});
const savingContext = {version:'eval-context-v2',simulated:true,actions:[{
  id:'saving',intents:['enableSaving'],label:'开启省电',event:'enablePowerSaving',target:'battery',available:true,
}]};
const cleanContext = {version:'eval-context-v2',simulated:true,actions:[{
  id:'clean',intents:['cleanMemory'],label:'清理内存',event:'cleanDeviceMemory',target:'memory',available:true,
}]};

export const datasetV2 = [
  {
    id:'cal-01',split:'calibration',category:'fact-only',text:'手机当前剩余电量为18%，只展示状态。',context:{},
    confirmedSemantics:doc({domain:'energy',topic:'手机电量',facts:[fact({id:'battery',subject:'battery',label:'剩余电量',value:'18',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',source:'剩余电量为18%'})]}),
    expected:{semantics:{task:'card',domain:'energy',facts:[{subject:'battery',value:'18',unit:'%',dataType:'percentage'}],actionMode:'unmentioned'},decision:{status:'ready',components:['text','miniProgress'],delivery:'deliverable'}},
  },
  {
    id:'cal-02',split:'calibration',category:'registered-action',text:'手机电量18%，请开启省电模式。',context:savingContext,
    confirmedSemantics:doc({domain:'energy',topic:'手机电量',facts:[fact({id:'battery',subject:'battery',label:'剩余电量',value:'18',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',source:'手机电量18%'})],actions:{mode:'specified',requests:[{intent:'enableSaving',label:'开启省电',target:'battery',required:true}],forbiddenIntents:[]}}),
    expected:{semantics:{domain:'energy',facts:[{subject:'battery',value:'18',unit:'%'}],requestedIntents:['enableSaving']},decision:{status:'ready',components:['text','miniProgress','capsuleButton'],actionEvent:'enablePowerSaving',delivery:'deliverable'}},
  },
  {
    id:'cal-03',split:'calibration',category:'specific-negation',text:'手机电量18%，不要清理内存。',context:cleanContext,
    confirmedSemantics:doc({domain:'energy',topic:'手机电量',facts:[fact({id:'battery',subject:'battery',label:'剩余电量',value:'18',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',source:'手机电量18%'})],actions:{mode:'specified',requests:[],forbiddenIntents:['cleanMemory']}}),
    expected:{semantics:{domain:'energy',forbiddenIntents:['cleanMemory'],requestedIntents:[]},decision:{status:'ready',components:['text','miniProgress'],delivery:'deliverable'}},
  },
  {
    id:'cal-04',split:'calibration',category:'duration',text:'今天专注25分钟。',context:{},
    confirmedSemantics:doc({domain:'productivity',topic:'专注计时',facts:[fact({id:'focus',subject:'focus',label:'专注时长',value:'25',unit:'分钟',dataType:'duration',source:'专注25分钟'})]}),
    expected:{semantics:{domain:'productivity',facts:[{subject:'focus',value:'25',unit:'分钟',dataType:'duration'}]},decision:{status:'ready',components:['text','heroMetric'],delivery:'deliverable'}},
  },
  {
    id:'cal-05',split:'calibration',category:'fact-correction',text:'不是电量18%，是内存占用18%。',context:{},
    confirmedSemantics:doc({domain:'system',topic:'内存状态',facts:[
      fact({id:'batteryOld',subject:'battery',label:'电量',value:'18',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',polarity:'negated',status:'superseded',role:'secondary',source:'不是电量18%'}),
      fact({id:'memory',subject:'memory',label:'内存占用',value:'18',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',source:'是内存占用18%'}),
    ]}),
    expected:{semantics:{domain:'system',primarySubject:'memory',facts:[{subject:'battery',polarity:'negated'},{subject:'memory',value:'18',unit:'%'}]},decision:{status:'ready',components:['text','miniProgress'],delivery:'deliverable'}},
  },
  {
    id:'cal-06',split:'calibration',category:'invalid-measurement',text:'设备显示电量−5%。',context:{},
    confirmedSemantics:doc({domain:'energy',topic:'手机电量',facts:[fact({id:'battery',subject:'battery',label:'剩余电量',value:'-5',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',source:'电量−5%'})]}),
    expected:{semantics:{domain:'energy',facts:[{subject:'battery',value:'-5',unit:'%'}]},decision:{status:'needs_clarification',code:'invalid_measurement',delivery:'not_applicable'}},
  },
  {
    id:'cal-07',split:'calibration',category:'long-required-text',text:'重要通知：由于场地临时关闭，原定活动安排全部作废，请告知参与者并更新日程，会议已取消，请勿前往。',context:{},
    confirmedSemantics:doc({domain:'productivity',topic:'重要通知',facts:[fact({id:'message',subject:'message',label:'通知',value:'重要通知：由于场地临时关闭，原定活动安排全部作废，请告知参与者并更新日程，会议已取消，请勿前往。',dataType:'text',source:'完整通知'})]}),
    expected:{semantics:{task:'card',facts:[{subject:'message',dataType:'text'}]},decision:{status:'unsupported',code:'required_text_too_long',delivery:'not_applicable'}},
  },
  {
    id:'cal-08',split:'calibration',category:'parallel-metrics',text:'同时显示CPU 32%、内存4.5GB、磁盘68%。',context:{},
    confirmedSemantics:doc({domain:'system',topic:'设备状态',facts:[
      fact({id:'cpu',subject:'cpu',label:'CPU',value:'32',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',role:'parallel',source:'CPU 32%'}),
      fact({id:'memory',subject:'memory',label:'内存',value:'4.5',unit:'GB',dataType:'capacity',role:'parallel',source:'内存4.5GB'}),
      fact({id:'disk',subject:'disk',label:'磁盘',value:'68',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',role:'parallel',source:'磁盘68%'}),
    ]}),
    expected:{semantics:{domain:'system',facts:[{subject:'cpu',value:'32'},{subject:'memory',value:'4.5'},{subject:'disk',value:'68'}]},decision:{status:'ready',components:['text','metric','metric','metric'],delivery:'deliverable'}},
  },
  {
    id:'cal-09',split:'calibration',category:'scaled-score',text:'睡眠评分82分，满分100。',context:{},
    confirmedSemantics:doc({domain:'wellness',topic:'健康摘要',facts:[fact({id:'sleepScore',subject:'sleep',label:'睡眠评分',value:'82',unit:'分',dataType:'score',scale:{min:0,max:100},source:'睡眠评分82分，满分100'})]}),
    expected:{semantics:{domain:'wellness',facts:[{subject:'sleep',value:'82',dataType:'score'}]},decision:{status:'ready',components:['text','progressRing'],delivery:'deliverable'}},
  },
  {
    id:'cal-10',split:'calibration',category:'conflicting-fact',text:'当前电量一处显示18%，另一处显示82%，无法确认哪个正确。',context:{},
    confirmedSemantics:doc({domain:'energy',topic:'手机电量',facts:[
      fact({id:'batteryA',subject:'battery',label:'当前电量',value:'18',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',status:'conflicting',source:'显示18%'}),
      fact({id:'batteryB',subject:'battery',label:'当前电量',value:'82',unit:'%',dataType:'percentage',progressSemantics:'bounded_measurement',status:'conflicting',source:'显示82%'}),
    ],ambiguities:[{code:'conflicting_fact',factIds:['batteryA','batteryB'],question:'当前电量应使用18%还是82%？'}]}),
    expected:{semantics:{domain:'energy',ambiguityCount:1},decision:{status:'needs_clarification',code:'conflicting_fact',delivery:'not_applicable'}},
  },
  {
    id:'cal-11',split:'calibration',category:'non-card',text:'写一首关于海边黄昏的诗。',context:{},
    confirmedSemantics:doc({task:'non_card',topic:'非卡片任务',facts:[]}),
    expected:{semantics:{task:'non_card',domain:'generic'},decision:{status:'no_card',code:'non_card_request',delivery:'not_applicable'}},
  },
  {
    id:'cal-12',split:'calibration',category:'verified-image',text:'只展示这张照片。',context:{image:{id:'photo-1',src:'/photo.jpg',alt:'湖边日落',verified:true}},
    confirmedSemantics:doc({topic:'照片',facts:[fact({id:'image',subject:'image',label:'图片',value:null,dataType:'image',status:'current',source:'这张照片'})]}),
    expected:{semantics:{task:'card',facts:[{subject:'image',dataType:'image'}]},decision:{status:'ready',components:['text','image'],delivery:'deliverable'}},
  },
];

export const datasetV2Metadata = {
  name:'semantic-v2-calibration',
  independent:false,
  purpose:'开发与评分链路校准；禁止作为独立 Qwen 结论数据集',
};
